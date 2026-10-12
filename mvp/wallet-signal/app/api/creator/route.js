import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";

export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 1000;
const HISTORY_PAGE_CAP = 3;
const INDEXED_CANDIDATE_CAP = 30;

async function inspectMintOrigin(connection, mint, cursor = null) {
  let before = cursor || undefined;
  let earliest = null;
  let exhausted = false;
  let pages = 0;
  let oldestPage = [];
  for (let i = 0; i < HISTORY_PAGE_CAP; i++) {
    const rows = await connection.getSignaturesForAddress(mint, { limit: HISTORY_PAGE_SIZE, ...(before ? { before } : {}) }, "confirmed");
    pages++;
    if (!rows.length) { exhausted = true; break; }
    earliest = rows[rows.length - 1];
    oldestPage = rows;
    if (rows.length < HISTORY_PAGE_SIZE) { exhausted = true; break; }
    before = earliest.signature;
  }
  const coverage = { pagesScanned: pages, historyExhaustedWithinRpc: exhausted, oldestObservedSignature: earliest?.signature || null, nextCursor: exhausted ? null : earliest?.signature || null, archivalCompletenessVerified: false };
  if (!earliest || !exhausted) return { status: "unverified", reason: exhausted ? "No additional mint history returned by this RPC; archival completeness remains unverified." : "Earliest mint history not established within bounded RPC scan. Continue searching older signatures.", coverage };
  // Inspect a small window of the oldest RPC-visible transactions, not just one.
  // Some token launches have multiple setup instructions/transactions.
  const candidates = oldestPage.slice(-12).reverse().filter(row => !row.err);
  let checked = 0;
  for (const row of candidates) {
    let tx;
    try { tx = await connection.getParsedTransaction(row.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }); }
    catch { continue; }
    checked++;
    if (!tx || tx.meta?.err) continue;
    const instructions = [...(tx.transaction?.message?.instructions || []), ...(tx.meta?.innerInstructions || []).flatMap(x => x.instructions || [])];
    const initialized = instructions.some(x => ["initializeMint", "initializeMint2"].includes(x.parsed?.type) && x.parsed?.info?.mint === mint.toBase58() && ["spl-token", "spl-token-2022"].includes(x.program));
    if (!initialized) continue;
    const signer = tx.transaction.message.accountKeys.find(x => x.signer && x.pubkey);
    return { status: "initialization_signer_observed", address: signer?.pubkey?.toBase58() || null, signature: row.signature, blockTime: row.blockTime ?? null, reason: "Verified mint initialization instruction found. Transaction signer is an origin candidate, not a verified creator or beneficial owner.", coverage: { ...coverage, initializationCandidatesChecked: checked } };
  }
  return { status: "unverified", reason: "No mint initialization instruction found among the oldest available transactions. Origin and creator remain unverified.", coverage: { ...coverage, initializationCandidatesChecked: checked } };
}


async function inspectIndexedOrigin(endpoint, mint, connection) {
  // Helius oldest-first indexed history; independently verify on-chain initialization.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransactionsForAddress",
        params: [mint.toBase58(), { sortOrder: "asc", transactionDetails: "signatures", limit: INDEXED_CANDIDATE_CAP }] })
    });
    if (!response.ok) return { status: "unavailable", reason: response.status === 401 || response.status === 403 ? "Indexed history access denied. Verify provider key and plan permissions." : response.status === 429 ? "Indexed history rate limit reached. Retry later." : response.status === 404 ? "Indexed history method unavailable at this endpoint." : "Indexed history HTTP request failed.", diagnostic: { code: "INDEXED_HTTP_" + response.status, httpStatus: response.status } };
    const payload = await response.json();
    if (payload.error) { const code = payload.error.code; const message = String(payload.error.message || "").slice(0, 180); return { status: "unavailable", reason: code === -32601 ? "Indexed history RPC method is not supported by this endpoint or plan." : "Indexed history RPC returned an error; using bounded RPC fallback.", diagnostic: { code: "INDEXED_RPC_ERROR", rpcCode: code ?? null, providerMessage: message.replace(/https?:\/\/\S+/g, "[redacted endpoint]") } }; }
    // Helius indexed history may return signatures, transaction objects, or a
    // provider-specific wrapper. Never mistake an unrecognized response for
    // verified absence of historical transactions.
    const result = payload.result;
    const rows = Array.isArray(result) ? result :
      Array.isArray(result?.transactions) ? result.transactions :
      Array.isArray(result?.data) ? result.data :
      Array.isArray(result?.signatures) ? result.signatures :
      Array.isArray(result?.items) ? result.items : null;
    const signatures = (rows || []).map(x => typeof x === "string" ? x :
      x?.signature || x?.signatures?.[0] || x?.transaction?.signatures?.[0] || x?.transaction?.signature || null)
      .filter(x => typeof x === "string");
    const coverage = { provider: "helius_indexed", sortOrder: "asc",
      signaturesReturned: signatures.length, responseShape: Array.isArray(result) ? "array" : Object.keys(result || {}).slice(0, 8), archivalCompletenessVerified: false };
    if (!rows) return { status: "unavailable", reason: "Indexed provider returned an unrecognized response; using RPC fallback.", diagnostic: { code: "INDEXED_UNRECOGNIZED_RESPONSE" }, coverage };
    if (!signatures.length) return { status: "unavailable", reason: "Indexed provider returned no usable signatures; using RPC fallback.", diagnostic: { code: "INDEXED_NO_SIGNATURES", rowsReturned: rows.length }, coverage };
    // Oldest-first is requested from the indexer, but this is not proof of full archival coverage.
    let checked = 0;
    for (const signature of signatures.slice(0, INDEXED_CANDIDATE_CAP)) {
      let tx;
      try { tx = await connection.getParsedTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }); } catch { continue; }
      checked++;
      if (!tx || tx.meta?.err) continue;
      const instructions = [...(tx.transaction?.message?.instructions || []), ...(tx.meta?.innerInstructions || []).flatMap(x => x.instructions || [])];
      if (!instructions.some(x => ["initializeMint", "initializeMint2"].includes(x.parsed?.type) && x.parsed?.info?.mint === mint.toBase58() && ["spl-token", "spl-token-2022"].includes(x.program))) continue;
      const signers = tx.transaction.message.accountKeys.filter(x => x.signer && x.pubkey).map(x => x.pubkey.toBase58());
      return { status: "initialization_signer_observed", address: signers[0] || null, signers, signature, blockTime: tx.blockTime ?? null,
        reason: "Verified on-chain mint initialization found in oldest-first indexed history. Signers are origin candidates, NOT verified creators or beneficial owners.",
        coverage: { ...coverage, initializationCandidatesChecked: checked } };
    }
    return { status: "unavailable", reason: "No mint initialization verified in indexed response; continue with bounded RPC history.", coverage: { ...coverage, initializationCandidatesChecked: checked } };
  } catch (error) { return { status: "unavailable", reason: error?.name === "AbortError" ? "Indexed history timed out after 12 seconds; using bounded RPC fallback." : "Indexed history request failed; using bounded RPC fallback.", diagnostic: { code: error?.name === "AbortError" ? "INDEXED_TIMEOUT" : "INDEXED_NETWORK_FAILURE" } }; }
  finally { clearTimeout(timer); }
}

/**
 * CB-01: Mint provenance, not a creator-identity assertion.
 * Mint authority is a permission and may not identify the original deployer.
 * Historical creator attribution requires a verified launch transaction/indexer.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("mint") || "";
  const before = url.searchParams.get("before");
  if (before && !/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(before)) {
    return NextResponse.json({ error: "Invalid historical scan cursor" }, { status: 400 });
  }
  let mint;
  try {
    mint = new PublicKey(address);
    if (!PublicKey.isOnCurve(mint.toBytes())) {
      // Program-derived mints can exist. Do not reject them on curve checks.
    }
  } catch {
    return NextResponse.json({ error: "Invalid Solana token mint address" }, { status: 400 });
  }
  try {
    const connection = createReliableConnection();
    // Fetch raw account bytes independently: parsed RPC responses are not always supported.
    const [rawCheck, parsedCheck, supplyCheck] = await Promise.allSettled([
      connection.getAccountInfo(mint, "confirmed"),
      connection.getParsedAccountInfo(mint, "confirmed"),
      connection.getTokenSupply(mint, "confirmed")
    ]);
    const rawAccount = rawCheck.status === "fulfilled" ? rawCheck.value : null;
    const parsedAccount = parsedCheck.status === "fulfilled" ? parsedCheck.value?.value : null;
    const supply = supplyCheck.status === "fulfilled" ? supplyCheck.value : null;
    if (!rawAccount && !parsedAccount) {
      if (rawCheck.status === "rejected" || parsedCheck.status === "rejected") {
        return NextResponse.json({ error: "RPC verification unavailable.", detail: "The Solana RPC could not confirm this account. Please retry later.", errorCode: "RPC_UNAVAILABLE" }, { status: 503 });
      }
      return NextResponse.json({ error: "Account not found on the selected Solana RPC.", detail: "Check the full token mint address and network.", errorCode: "ACCOUNT_NOT_FOUND" }, { status: 404 });
    }
    const account = rawAccount || parsedAccount;
    const owner = account.owner?.toBase58?.() || null;
    const TOKEN_PROGRAMS = {
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "spl-token",
      "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "spl-token-2022"
    };
    const tokenProgram = TOKEN_PROGRAMS[owner] || null;
    const parsed = parsedAccount?.data?.parsed;
    const isParsedMint = parsed?.type === "mint" && Boolean(tokenProgram);
    const bytes = rawAccount?.data;
    // Both SPL Token and Token-2022 share the 82-byte base mint layout.
    // Offset 45 is the initialized flag; token accounts use a different layout.
    const rawMint = Boolean(tokenProgram && bytes instanceof Uint8Array && bytes.length >= 82 &&
      (tokenProgram === "spl-token-2022" || bytes.length === 82) && bytes[45] === 1 &&
      bytes[0] <= 1 && bytes[46] <= 1);
    const supplyMint = Boolean(tokenProgram && supply?.value);
    if (!isParsedMint && !rawMint && !supplyMint) {
      if (!tokenProgram) {
        return NextResponse.json({ error: "Not an SPL Token or Token-2022 account.", detail: "The address is owned by a different program. Check that you pasted the token mint address.", errorCode: "NOT_TOKEN_PROGRAM", accountOwnerProgram: owner }, { status: 422 });
      }
      if (rawCheck.status === "rejected" || supplyCheck.status === "rejected") {
        return NextResponse.json({ error: "Token mint verification inconclusive.", detail: "The RPC could not return enough information to distinguish this account from a token holding account.", errorCode: "RPC_INCONCLUSIVE" }, { status: 503 });
      }
      return NextResponse.json({ error: "Address is not a verified token mint.", detail: "This may be a token holding account rather than the mint address.", errorCode: "NOT_MINT", accountType: parsed?.type || "unknown" }, { status: 422 });
    }
    const info = isParsedMint ? (parsed.info || {}) : {};
    const rawSupply = rawMint ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(36, true).toString() : null;
    const decimals = info.decimals ?? (rawMint ? bytes[44] : null) ?? supply?.value?.decimals ?? null;
    const displaySupply = supply?.value?.uiAmountString ?? (rawSupply !== null && decimals !== null ?
      (BigInt(rawSupply) / (10n ** BigInt(decimals))).toString() + (BigInt(rawSupply) % (10n ** BigInt(decimals)) ? "." + (BigInt(rawSupply) % (10n ** BigInt(decimals))).toString().padStart(decimals, "0").replace(/0+$/, "") : "") : null);
    const parsedMintDetailsAvailable = isParsedMint;
    const verificationMethod = isParsedMint ? "parsed_mint" : rawMint ? "raw_mint_layout" : "token_supply";
    let origin;
    // Optional archival RPC: configure HELIUS_RPC_URL server-side only.
    // No provider key is sent to the browser or included in API output.
    const archivalUrl = (process.env.HELIUS_RPC_URL || "").trim();
    const archivalConfigured = /^https:\/\//i.test(archivalUrl);
    const providerDiagnostic = !archivalUrl ? "missing_env" : !archivalConfigured ? "invalid_url_format" : "configured_not_verified";
    const originConnection = archivalConfigured
      ? createReliableConnection({ primary: archivalUrl, fallbacks: "", timeoutMs: 10000, retries: 1 })
      : connection;
    let providerConnectivity = archivalConfigured ? "not_tested" : "not_configured";
    if (archivalConfigured) {
      try { await originConnection.getVersion(); providerConnectivity = "confirmed"; }
      catch { providerConnectivity = "failed"; }
    }
    // CB-02B: oldest-first indexed lookup, with existing bounded RPC fallback.
    let indexedOrigin = null;
    if (archivalConfigured && providerConnectivity === "confirmed" && !before) {
      indexedOrigin = await inspectIndexedOrigin(archivalUrl, mint, originConnection);
    }
    if (indexedOrigin && indexedOrigin.status === "initialization_signer_observed") {
      origin = indexedOrigin;
    } else if (archivalConfigured && providerConnectivity === "failed") {
      origin = { status: "unverified", reason: "Configured archival RPC did not respond successfully. Verify provider credentials and endpoint.", coverage: { archivalCompletenessVerified: false } };
    } else {
      try { origin = await inspectMintOrigin(originConnection, mint, before); }
      catch { origin = { status: "unverified", reason: "Mint origin lookup unavailable.", coverage: { archivalCompletenessVerified: false } }; }
    }
    return NextResponse.json({
      mint: mint.toBase58(),
      tokenProgram,
      parsedMintDetailsAvailable,
      decimals,
      verificationMethod,
      supply: displaySupply,
      mintAuthority: info.mintAuthority ?? null,
      freezeAuthority: info.freezeAuthority ?? null,
      authoritiesAreCreatorIdentity: false,
      authorityDetailsStatus: parsedMintDetailsAvailable ? "available" : "not_parsed",
      creator: { status: "unverified", address: null, reason: "Mint and freeze authorities do not reliably identify the original token creator. Historical launch transaction and provenance indexing are required." },
      mintOrigin: origin,
      indexedHistoryDiagnostic: indexedOrigin ? { status: indexedOrigin.status, reason: indexedOrigin.reason || null, diagnostic: indexedOrigin.diagnostic || null, coverage: indexedOrigin.coverage || null } : { status: archivalConfigured ? (before ? "skipped_pagination" : "skipped_connectivity") : "not_configured" },
      historicalProvider: { mode: archivalConfigured ? "configured_archival_rpc" : "standard_rpc", diagnostic: archivalConfigured && providerConnectivity === "confirmed" ? "connection_confirmed" : archivalConfigured && providerConnectivity === "failed" ? "connection_failed" : providerDiagnostic, connectivity: providerConnectivity, archivalCompletenessVerified: false },
      creatorHoldingTime: { status: "not_available", reason: "Verified creator attribution and token sale ledger are not yet connected." },
      dataCoverage: { source: "Solana RPC mint account, Helius oldest-first indexed history when available, or bounded RPC history", historicalLaunchesChecked: 0, transactionHistoryDecoded: origin.signature ? 1 : 0 },
      interpretation: "This is a token mint inspection, not a scam verdict or creator-behavior assessment."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Unable to inspect token mint using the configured RPC", detail: /429|rate limit/i.test(String(error?.message)) ? "RPC rate limited" : "RPC request failed" }, { status: 503 });
  }
}

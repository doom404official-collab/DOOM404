import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";

export const dynamic = "force-dynamic";

const HISTORY_PAGE_SIZE = 1000;
const HISTORY_PAGE_CAP = 3;

async function inspectMintOrigin(connection, mint) {
  let before;
  let earliest = null;
  let exhausted = false;
  let pages = 0;
  for (let i = 0; i < HISTORY_PAGE_CAP; i++) {
    const rows = await connection.getSignaturesForAddress(mint, { limit: HISTORY_PAGE_SIZE, ...(before ? { before } : {}) }, "confirmed");
    pages++;
    if (!rows.length) { exhausted = true; break; }
    earliest = rows[rows.length - 1];
    if (rows.length < HISTORY_PAGE_SIZE) { exhausted = true; break; }
    before = earliest.signature;
  }
  const coverage = { pagesScanned: pages, historyExhaustedWithinRpc: exhausted, oldestObservedSignature: earliest?.signature || null, archivalCompletenessVerified: false };
  if (!earliest || !exhausted) return { status: "unverified", reason: "Earliest mint history not established within bounded RPC scan.", coverage };
  const tx = await connection.getParsedTransaction(earliest.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!tx || tx.meta?.err) return { status: "unverified", reason: "Earliest observed transaction unavailable or failed.", coverage };
  const instructions = [...(tx.transaction?.message?.instructions || []), ...(tx.meta?.innerInstructions || []).flatMap(x => x.instructions || [])];
  const initialized = instructions.some(x => ["initializeMint", "initializeMint2"].includes(x.parsed?.type) && x.parsed?.info?.mint === mint.toBase58() && ["spl-token", "spl-token-2022"].includes(x.program));
  if (!initialized) return { status: "unverified", reason: "Mint initialization was not verified in earliest observed transaction.", coverage };
  const signer = tx.transaction.message.accountKeys.find(x => x.signer && x.pubkey);
  return { status: "initialization_signer_observed", address: signer?.pubkey?.toBase58() || null, signature: earliest.signature, blockTime: earliest.blockTime ?? null, reason: "Initialization signer is an origin candidate, not a verified token creator or beneficial owner.", coverage };
}


/**
 * CB-01: Mint provenance, not a creator-identity assertion.
 * Mint authority is a permission and may not identify the original deployer.
 * Historical creator attribution requires a verified launch transaction/indexer.
 */
export async function GET(request) {
  const address = new URL(request.url).searchParams.get("mint") || "";
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
    try { origin = await inspectMintOrigin(connection, mint); }
    catch { origin = { status: "unverified", reason: "Mint origin lookup unavailable.", coverage: { archivalCompletenessVerified: false } }; }
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
      creatorHoldingTime: { status: "not_available", reason: "Verified creator attribution and token sale ledger are not yet connected." },
      dataCoverage: { source: "Solana RPC parsed/raw mint account and bounded mint history", historicalLaunchesChecked: 0, transactionHistoryDecoded: origin.signature ? 1 : 0 },
      interpretation: "This is a token mint inspection, not a scam verdict or creator-behavior assessment."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Unable to inspect token mint using the configured RPC", detail: /429|rate limit/i.test(String(error?.message)) ? "RPC rate limited" : "RPC request failed" }, { status: 503 });
  }
}

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
    const [account, supply] = await Promise.all([
      connection.getParsedAccountInfo(mint, "confirmed"),
      connection.getTokenSupply(mint, "confirmed").catch(() => null)
    ]);
    if (!account.value) {
      return NextResponse.json({ error: "Mint account not found on this RPC" }, { status: 404 });
    }
    const parsed = account.value.data?.parsed;
    if (parsed?.type !== "mint" || !["spl-token", "spl-token-2022"].includes(parsed?.program)) {
      return NextResponse.json({ error: "Address is not a parsed SPL token mint" }, { status: 422 });
    }
    const info = parsed.info || {};
    let origin;
    try { origin = await inspectMintOrigin(connection, mint); }
    catch { origin = { status: "unverified", reason: "Mint origin lookup unavailable.", coverage: { archivalCompletenessVerified: false } }; }
    return NextResponse.json({
      mint: mint.toBase58(),
      tokenProgram: parsed.program,
      decimals: info.decimals ?? null,
      supply: supply?.value?.uiAmountString ?? null,
      mintAuthority: info.mintAuthority ?? null,
      freezeAuthority: info.freezeAuthority ?? null,
      authoritiesAreCreatorIdentity: false,
      creator: { status: "unverified", address: null, reason: "Mint and freeze authorities do not reliably identify the original token creator. Historical launch transaction and provenance indexing are required." },
      mintOrigin: origin,
      creatorHoldingTime: { status: "not_available", reason: "Verified creator attribution and token sale ledger are not yet connected." },
      dataCoverage: { source: "Solana RPC parsed mint account and bounded mint history", historicalLaunchesChecked: 0, transactionHistoryDecoded: origin.signature ? 1 : 0 },
      interpretation: "This is a token mint inspection, not a scam verdict or creator-behavior assessment."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Unable to inspect token mint using the configured RPC", detail: /429|rate limit/i.test(String(error?.message)) ? "RPC rate limited" : "RPC request failed" }, { status: 503 });
  }
}

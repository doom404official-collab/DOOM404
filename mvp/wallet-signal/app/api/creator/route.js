import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({
      mint: mint.toBase58(),
      tokenProgram: parsed.program,
      decimals: info.decimals ?? null,
      supply: supply?.value?.uiAmountString ?? null,
      mintAuthority: info.mintAuthority ?? null,
      freezeAuthority: info.freezeAuthority ?? null,
      authoritiesAreCreatorIdentity: false,
      creator: { status: "unverified", address: null, reason: "Mint and freeze authorities do not reliably identify the original token creator. Historical launch transaction and provenance indexing are required." },
      creatorHoldingTime: { status: "not_available", reason: "Verified creator attribution and token sale ledger are not yet connected." },
      dataCoverage: { source: "Solana RPC parsed mint account", historicalLaunchesChecked: 0, transactionHistoryDecoded: 0 },
      interpretation: "This is a token mint inspection, not a scam verdict or creator-behavior assessment."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Unable to inspect token mint using the configured RPC", detail: /429|rate limit/i.test(String(error?.message)) ? "RPC rate limited" : "RPC request failed" }, { status: 503 });
  }
}

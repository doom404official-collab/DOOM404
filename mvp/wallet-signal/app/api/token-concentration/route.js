import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";
import { summarizeResolvedTokenAccounts } from "../../../lib/tokenAccountOwnership.js";

export const dynamic = "force-dynamic";

// RPC returns token ACCOUNTS, not unique beneficial owners. This is not holder concentration.
export async function GET(request) {
  const address = new URL(request.url).searchParams.get("mint") || "";
  let mint;
  try { mint = new PublicKey(address); }
  catch { return NextResponse.json({ error: "Invalid token mint address" }, { status: 400 }); }
  try {
    const connection = createReliableConnection();
    const [largest, supply] = await Promise.all([
      connection.getTokenLargestAccounts(mint, "confirmed"),
      connection.getTokenSupply(mint, "confirmed")
    ]);
    const total = BigInt(supply.value.amount);
    const accounts = largest.value.slice(0, 20).map((row, index) => ({
      rank: index + 1, tokenAccount: row.address.toBase58(),
      amount: row.amount, uiAmount: row.uiAmountString,
      sharePct: total > 0n ? Number(BigInt(row.amount) * 1000000n / total) / 10000 : null
    }));
    const parsedResults = await Promise.allSettled(accounts.map(row =>
      connection.getParsedAccountInfo(new PublicKey(row.tokenAccount), "confirmed")));
    const ownership = summarizeResolvedTokenAccounts(accounts,parsedResults.map(r=>r.status==="fulfilled"?r.value:null));
    const sum = (n) => accounts.slice(0, n).reduce((a, x) => a + BigInt(x.amount), 0n);
    const percent = n => total > 0n ? Number(sum(n) * 1000000n / total) / 10000 : null;
    return NextResponse.json({
      status: "observed_token_accounts", mint: mint.toBase58(), decimals: supply.value.decimals,
      totalRawSupply: supply.value.amount, returnedAccounts: accounts.length,
      largestAccountSharePct: percent(1), top5TokenAccountSharePct: percent(5),
      top10TokenAccountSharePct: percent(10), top20TokenAccountSharePct: percent(20), accounts: ownership.accounts,
      ownership: { observedOwnerGroups: ownership.observedOwnerGroups,
        resolvedAccountCount: ownership.resolvedAccountCount,
        ownerCoverageComplete: false, beneficialOwnersVerified: false,
        warning: ownership.warning },
      coverage: { source: "Solana getTokenLargestAccounts + getTokenSupply", maxAccounts: 20,
        isCompleteHolderList: false, uniqueOwnersResolved: false, exchangePoolEscrowExcluded: false,
        warning: "Token accounts are not unique wallets or beneficial owners. Pools, exchanges, escrow and multiple accounts per owner can distort concentration. These are observed account balances, not a scam score." },
      interpretation: "Descriptive account-balance evidence only. No holder ownership or risk verdict inferred."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", error: "Largest token-account balances unavailable from RPC; do not infer concentration." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";
import { decodePumpAmmPoolState } from "../../../lib/pumpAmmPoolState.mjs";
import { inspectTokenVault } from "../../../lib/liquidityVaultEvidence.mjs";

export const dynamic = "force-dynamic";
const MAX_POOLS = 5;
const valid = value => {
  try {
    const key = new PublicKey(value);
    return key.toBase58() === value ? key : null;
  } catch { return null; }
};

// Existence and program ownership only. No protocol-specific reserve/LP claims.
export async function POST(request) {
  let payload;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const mint = valid(payload?.mint);
  const addresses = payload?.poolAddresses;
  if (!mint || !Array.isArray(addresses) || !addresses.length || addresses.length > MAX_POOLS ||
      addresses.some(x => !valid(x)) || new Set(addresses).size !== addresses.length) {
    return NextResponse.json({ error: "Supply a valid mint and 1–5 distinct Solana pool addresses" }, { status: 400 });
  }
  try {
    const connection = createReliableConnection({ timeoutMs: 6000, retries: 1 });
    const accounts = await connection.getMultipleAccountsInfo(addresses.map(x => valid(x)), "confirmed");
    const candidates = accounts.map(account => account ? decodePumpAmmPoolState(account.data,account.owner.toBase58()) : null);
    const vaultAddresses = [...new Set(candidates.flatMap(candidate => candidate && [candidate.baseMint,candidate.quoteMint].includes(mint.toBase58()) ? [candidate.poolBaseTokenAccount,candidate.poolQuoteTokenAccount] : []))];
    const vaultAccounts = vaultAddresses.length ? await connection.getMultipleAccountsInfo(vaultAddresses.map(address => new PublicKey(address)),"confirmed") : [];
    const vaultLookup = new Map(vaultAddresses.map((address,index)=>[address,vaultAccounts[index]]));
    const observedAt = new Date().toISOString();
    return NextResponse.json({
      status: "account_checks_completed", mint: mint.toBase58(), observedAt,
      commitment: "confirmed", source: "Solana RPC getMultipleAccounts",
      pools: addresses.map((address, index) => ({
        pairAddress: address,
        accountExists: accounts[index] !== null,
        accountOwnerProgram: accounts[index]?.owner?.toBase58() ?? null,
        accountExecutable: accounts[index]?.executable ?? null,
        accountLamports: accounts[index]?.lamports ?? null,
        decodedPumpAmmCandidate: candidates[index] && [candidates[index].baseMint,candidates[index].quoteMint].includes(mint.toBase58()) ? candidates[index] : null,
        vaultAccountEvidence: candidates[index] && [candidates[index].baseMint,candidates[index].quoteMint].includes(mint.toBase58()) ? {
          base: inspectTokenVault(vaultLookup.get(candidates[index].poolBaseTokenAccount),candidates[index].baseMint),
          quote: inspectTokenVault(vaultLookup.get(candidates[index].poolQuoteTokenAccount),candidates[index].quoteMint),
          poolAuthorityVerified:false,
          reserveBalancesIndependentlyRead:true,
          reservesVerified:false
        } : null,
        protocolVerified: false, reservesVerified: false,
        lpLocksVerified: false, lpBurnsVerified: false, withdrawalRightsVerified: false,
        limitation: "Account existence and owner program do not prove this is an authentic liquidity pool, verify reserves, or establish LP custody."
      })),
      coverage: { decodedStateIsUnverified: true, checked: addresses.length, completePoolInventory: false, protocolVerified: false, reservesVerified: false,
        warning: "Do not interpret an account owner program as proof of pool legitimacy or lock status." }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", reason: "RPC pool-account verification failed; no pool verification claims issued." }, { status: 503 });
  }
}

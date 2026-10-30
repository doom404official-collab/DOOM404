import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { normalizeReportedPools } from "../../../lib/poolEvidence.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const value = new URL(request.url).searchParams.get("mint") || "";
  let mint;
  try { mint = new PublicKey(value).toBase58(); }
  catch { return NextResponse.json({ error: "Invalid token mint address" }, { status: 400 }); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch("https://api.dexscreener.com/token-pairs/v1/solana/" + encodeURIComponent(mint), {
      cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" }
    });
    if (!response.ok) return NextResponse.json({ status: "unavailable", reason: "Market-data provider unavailable", httpStatus: response.status }, { status: 503 });
    const payload = await response.json();
    if (!Array.isArray(payload)) return NextResponse.json({ status: "unavailable", reason: "Unrecognized market-data response" }, { status: 503 });
    const rows = normalizeReportedPools(payload, mint);
    const reported = rows.filter(x => x.liquidityUsd !== null);
    const sum = reported.reduce((total, row) => total + row.liquidityUsd, 0);
    const coherent=rows.every(x=>x.evidenceConflict!==true)&&Number.isFinite(sum);
    const largestShare = coherent&&sum > 0 ? reported[0].liquidityUsd / sum * 100 : null;
    return NextResponse.json({
      status: rows.length ? "pools_reported" : "no_pools_reported",
      mint, observedAt: new Date().toISOString(), provider: "DexScreener",
      poolCountReturned: rows.length, pools: rows.slice(0, 30),
      reportedLiquidityUsd: coherent&&reported.length ? sum : null,
      largestReportedPoolSharePct: largestShare,
      coverage: {
        scope: "Deduplicated, syntactically valid Solana pool addresses returned by DexScreener; not an exhaustive on-chain pool inventory",
        poolAccountExistence: "not_checked", poolProgramOwnership: "not_checked", reservesVerified: false,
        liquidity: "Provider-reported USD estimates, not independently verified reserve balances",
        concentration: "Share among returned pools with numeric liquidity, not all pools",
        lpLocksVerified: false, lpBurnsVerified: false, withdrawalRightsVerified: false,
        warning: "Missing pools or missing liquidity do not establish zero liquidity. LP locks, burns, reserve control and rug risk have not been verified."
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", reason: "Market-data lookup timed out or failed. Liquidity remains unassessed." }, { status: 503 });
  } finally { clearTimeout(timer); }
}

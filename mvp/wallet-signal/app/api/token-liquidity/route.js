import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";
const finite = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const shortText = value => typeof value === "string" ? value.slice(0, 120) : null;

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
    const rows = payload.filter(x => x?.chainId === "solana" && (x?.baseToken?.address === mint || x?.quoteToken?.address === mint))
      .map(x => ({
        pairAddress: shortText(x.pairAddress), dexId: shortText(x.dexId),
        baseSymbol: shortText(x.baseToken?.symbol), quoteSymbol: shortText(x.quoteToken?.symbol),
        liquidityUsd: finite(x.liquidity?.usd), volume24hUsd: finite(x.volume?.h24),
        pairCreatedAt: Number.isFinite(x.pairCreatedAt) ? x.pairCreatedAt : null,
        url: typeof x.url === "string" && /^https:\/\/dexscreener\.com\/solana\//.test(x.url) ? x.url : null
      })).filter(x => x.pairAddress).sort((a,b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
    const reported = rows.filter(x => x.liquidityUsd !== null);
    const sum = reported.reduce((total, row) => total + row.liquidityUsd, 0);
    const largestShare = sum > 0 ? reported[0].liquidityUsd / sum * 100 : null;
    return NextResponse.json({
      status: rows.length ? "pools_reported" : "no_pools_reported",
      mint, observedAt: new Date().toISOString(), provider: "DexScreener",
      poolCountReturned: rows.length, pools: rows.slice(0, 30),
      reportedLiquidityUsd: reported.length ? sum : null,
      largestReportedPoolSharePct: largestShare,
      coverage: {
        scope: "Pools returned by DexScreener for this mint; not an exhaustive on-chain pool inventory",
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

// Pool-discovery normalization. This is NOT an on-chain reserve or LP-lock verification.
import { PublicKey } from "@solana/web3.js";

export function normalizePoolAddress(value) {
  if (typeof value !== "string") return null;
  try {
    const key = new PublicKey(value);
    return key.toBase58() === value ? value : null;
  } catch { return null; }
}
export function normalizeReportedPools(payload, mint) {
  if (!Array.isArray(payload)) return [];
  const normalized = payload.filter(x => x?.chainId === "solana" && (x?.baseToken?.address === mint || x?.quoteToken?.address === mint))
    .map(x => {
      const pairAddress = normalizePoolAddress(x.pairAddress);
      if (!pairAddress) return null;
      return {
        pairAddress,
        baseMint:normalizePoolAddress(x.baseToken?.address),quoteMint:normalizePoolAddress(x.quoteToken?.address),
        dexId: typeof x.dexId === "string" ? x.dexId.slice(0,120) : null,
        baseSymbol: typeof x.baseToken?.symbol === "string" ? x.baseToken.symbol.slice(0,120) : null,
        quoteSymbol: typeof x.quoteToken?.symbol === "string" ? x.quoteToken.symbol.slice(0,120) : null,
        liquidityUsd: typeof x.liquidity?.usd === "number" && Number.isFinite(x.liquidity.usd) && x.liquidity.usd >= 0 ? x.liquidity.usd : null,
        volume24hUsd: typeof x.volume?.h24 === "number" && Number.isFinite(x.volume.h24) && x.volume.h24 >= 0 ? x.volume.h24 : null,
        pairCreatedAt: Number.isFinite(x.pairCreatedAt) ? x.pairCreatedAt : null,
        url: typeof x.url === "string" && /^https:\/\/dexscreener\.com\/solana\//.test(x.url) ? x.url : null,
        poolAddressFormat: "valid_solana_pubkey",
        poolAccountExistence: "not_checked",
        poolProgramOwnership: "not_checked",
        reservesVerified: false,
        lpLocksVerified: false,
        lpBurnsVerified: false,
        withdrawalRightsVerified: false
      };
    }).filter(Boolean);
  const groups=new Map();
  for(const row of normalized){const observations=groups.get(row.pairAddress)||new Map();observations.set(JSON.stringify(row),row);groups.set(row.pairAddress,observations);}
  return [...groups.entries()].map(([pairAddress,observations])=>observations.size===1?[...observations.values()][0]:{
    pairAddress,baseMint:null,quoteMint:null,dexId:null,baseSymbol:null,quoteSymbol:null,liquidityUsd:null,volume24hUsd:null,pairCreatedAt:null,url:null,evidenceConflict:true,
    poolAddressFormat:'valid_solana_pubkey',poolAccountExistence:'not_checked',poolProgramOwnership:'not_checked',reservesVerified:false,lpLocksVerified:false,lpBurnsVerified:false,withdrawalRightsVerified:false
  }).sort((a,b)=>(b.liquidityUsd??-1)-(a.liquidityUsd??-1)||(a.pairAddress<b.pairAddress?-1:a.pairAddress>b.pairAddress?1:0));
}

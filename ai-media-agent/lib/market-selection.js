// Canonical quote mint identities, not ticker symbols. Source documentation:
// https://solana.com/docs/tokens/basics/sync-native
// https://developers.circle.com/stablecoins/usdc-contract-addresses
// https://tether.to/en/supported-protocols/
const QUOTE_MINTS=new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
]);
const finite=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))?Number(x):null;
function selectMarketPair(data,mint){
  const related=Array.isArray(data)?data.filter(p=>p.chainId==="solana"&&(p.baseToken?.address===mint||p.quoteToken?.address===mint)):[];
  const bases=related.filter(p=>p.baseToken?.address===mint);
  const canonical=bases.filter(p=>p.quoteToken?.address!==mint&&QUOTE_MINTS.has(p.quoteToken?.address));
  const eligible=canonical.filter(p=>finite(p.priceUsd)>0&&finite(p.liquidity?.usd)>0);
  eligible.sort((a,b)=>finite(b.liquidity.usd)-finite(a.liquidity.usd));
  return {pair:eligible[0]||null,identityPair:bases[0]||related[0]||null,diagnostics:{
    status:eligible.length?"CANONICAL_QUOTE_PAIR_SELECTED":"UNRESOLVED_NO_ELIGIBLE_CANONICAL_QUOTE_PAIR",
    exactMintPairs:related.length,eligiblePairs:eligible.length,
    exoticQuotePairsExcluded:bases.length-canonical.length,
    reversedPairsExcluded:related.length-bases.length,
    invalidMetricPairsExcluded:canonical.length-eligible.length,
    quoteMintPolicy:[...QUOTE_MINTS],
    limitation:"Reported pair metrics are not independently verified prices or aggregate market metrics. Quote-side token orientation is unsupported; base-token prices and trade counts are never relabeled as quote-token metrics."
  }};
}
module.exports={selectMarketPair,QUOTE_MINTS};

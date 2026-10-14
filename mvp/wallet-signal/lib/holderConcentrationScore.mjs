/** GLITCH holder-structure quality score. Higher means healthier distribution.
 * Thresholds are initial transparent product rules, not calibrated scam probabilities.
 * Missing independent ownership evidence is never converted to a confirmed connection.
 */
const clamp=n=>Math.max(0,Math.min(1,n));
const points=(share,limit,good,bad)=>Math.round(limit*(1-clamp((share-good)/(bad-good))));
export function scoreHolderConcentration({top20SharePct,largestAccountSharePct,holders=[],connectedGroups=[],directPairs=0,connectedWallets=0,walletHistoriesReached=0,ownerWalletsResolved=0,historyComplete=false}={}){
 const valid=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=100;
 const top20=valid(top20SharePct)?top20SharePct:null;
 const largest=valid(largestAccountSharePct)?largestAccountSharePct:(holders.length?Math.max(...holders.map(h=>Number(h.sharePct)||0)):null);
 const hasHistory=walletHistoriesReached>0;
 const largestConnected=Math.max(0,...connectedGroups.map(g=>Number(g.combinedObservedSharePct)||0));
 const distribution=hasHistory?points(largestConnected,20,5,35):null;
 const walletConnections=hasHistory?Math.round(10-4*clamp(connectedWallets/Math.max(1,ownerWalletsResolved))):null;
 const components=[
  {id:"top20",label:"Top-20 concentration",max:40,score:top20===null?null:points(top20,40,15,65),valuePct:top20},
  {id:"connections",label:"Wallet connections",max:10,score:walletConnections,connectedWallets,directPairs},
  {id:"combined",label:"Combined distribution",max:20,score:distribution,valuePct:hasHistory?largestConnected:null},
  {id:"largest",label:"Largest account",max:20,score:largest===null?null:points(largest,20,2,20),valuePct:largest},
  {id:"integrity",label:"Evidence integrity",max:10,score:ownerWalletsResolved>0?Math.round(6*clamp(ownerWalletsResolved/20)):null}
 ];
 const scored=components.filter(c=>c.score!==null);
 const earned=scored.reduce((n,c)=>n+c.score,0),possible=scored.reduce((n,c)=>n+c.max,0);
 return {score:possible===100?earned:null,earned,possible,
  components,historyComplete,confidence:historyComplete?"full-provider-observed":"limited-history",
  methodology:"Initial threshold-based scoring; connected transfers are a weak diagnostic, not proof of shared control. Unclassified custody/pools do not earn classification points."};
}

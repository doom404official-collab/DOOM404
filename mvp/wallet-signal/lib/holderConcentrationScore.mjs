/** Holder structure v2: 100-point observed-data assessment.
 * Higher is healthier. An unobserved connection is NOT proof of independence.
 * Thresholds are provisional and must be calibrated on diverse token cohorts.
 */
const clamp=n=>Math.max(0,Math.min(1,n));
const round=n=>Math.round(n*100)/100;
const valid=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=100;
const points=(share,max,good,bad)=>round(max*(1-clamp((share-good)/(bad-good))));
export function scoreHolderConcentration({top20SharePct,largestAccountSharePct,holders=[],connectedGroups=[],directPairs=0,connectedWallets=0,walletHistoriesReached=0,ownerWalletsResolved=0,custodyClassificationComplete=false,historyComplete=false}={}){
 const top20=valid(top20SharePct)?top20SharePct:null;
 const largest=valid(largestAccountSharePct)?largestAccountSharePct:(holders.length?Math.max(...holders.map(h=>Number(h.sharePct)||0)):null);
 const count=Math.max(0,Math.min(20,Math.floor(Number(ownerWalletsResolved)||0)));
 const uniqueOwners=holders.length?new Set(holders.map(h=>h.ownerWallet).filter(Boolean)).size:count;
 const pairsPossible=uniqueOwners*(uniqueOwners-1)/2;
 const observedPairs=Number.isFinite(Number(directPairs))?Math.max(0,Number(directPairs)):0;
 const density=pairsPossible>0?clamp(observedPairs/pairsPossible):0;
 const connectedShares=connectedGroups.map(g=>Number(g.combinedObservedSharePct)).filter(valid);
 const largestConnected=connectedShares.length?Math.max(...connectedShares):0;
 const components=[
  {id:"top20",label:"Top-20 concentration",max:40,score:top20===null?null:points(top20,40,15,65),valuePct:top20},
  {id:"connections",label:"Wallet connections",max:10,score:round(10*(1-clamp(density/0.2))),directPairs:observedPairs,possiblePairs:pairsPossible,connectionDensityPct:round(density*100)},
  {id:"combined",label:"Combined distribution",max:20,score:points(largestConnected,20,5,35),valuePct:largestConnected},
  {id:"largest",label:"Largest account",max:20,score:largest===null?null:points(largest,20,2,20),valuePct:largest},
  {id:"integrity",label:"Evidence integrity",max:10,score:round(6*clamp(count/20)+(custodyClassificationComplete?4:0))}
 ];
 const earned=round(components.reduce((sum,c)=>sum+(c.score??0),0));
 const possible=components.reduce((sum,c)=>sum+(c.score===null?0:c.max),0);
 return {score:possible===100?earned:null,earned,possible,components,
  observedDirectPairs:observedPairs,possiblePairs:pairsPossible,connectionDensityPct:round(density*100),
  historyComplete:Boolean(historyComplete),walletHistoriesReached,classificationComplete:Boolean(custodyClassificationComplete),
  methodology:"Scores are based on retrievable on-chain data available at the time of analysis. Historical coverage may vary, and transaction connections do not establish coordinated trading."};
}

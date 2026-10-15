// Holder Independence & Network Influence: 35-point component.
// Higher points = healthier observed holder independence.
// Direct links, repeated pair interactions and indirect paths have distinct weights.
// Thresholds are fixed v1 policy, subject to cohort validation before public release.
const clamp=x=>Math.max(0,Math.min(1,x));
const round=x=>Math.round(x*100)/100;
export function scoreTop20Network({holders,transfers,network,exposure,historyCoverage}={}){
 if(!Array.isArray(holders)||holders.length<1||holders.length>20||!Array.isArray(transfers)||!network||!exposure)
  throw new TypeError('Frozen Top20 and consolidated network evidence required');
 const top=new Set(holders.map(h=>h.wallet));
 const pairs=new Map();
 for(const e of transfers){
  if(e?.verifiedOnChain!==true||e?.transferVerified!==true||!top.has(e.from)||!top.has(e.to)||e.from===e.to)continue;
  const key=[e.from,e.to].sort().join('|');
  if(!pairs.has(key))pairs.set(key,new Set());
  pairs.get(key).add(e.signature);
 }
 const directPairs=pairs.size;
 const repeatedPairs=[...pairs.values()].filter(s=>s.size>=3).length;
 const directHolders=new Set([...pairs.keys()].flatMap(k=>k.split('|'))).size;
 const indirectHolders=Math.max(0,network.connectedHolderCount-directHolders);
 const largest=exposure.largestClusterPct;
 // Max penalties: direct pairs 10, repeated pairs 5, indirect holders 5, largest cluster 15.
 const penalties={
  direct:round(10*clamp(directPairs/15)),
  repeated:round(5*clamp(repeatedPairs/5)),
  indirect:round(5*clamp(indirectHolders/10)),
  concentration:round(15*clamp(largest/35))
 };
 const total=round(Object.values(penalties).reduce((a,b)=>a+b,0));
 return {score:round(35-total),maxScore:35,penalties,
  evidence:{directPairs,repeatedPairs,directHolders,indirectHolders,
   largestClusterPct:largest,historyCoverage:historyCoverage??null},
  status:'observed_evidence',methodology:'TOP20_NETWORK_V1',
  note:'Transactions indicate observed links, not shared control; incomplete history may understate links.'};
}

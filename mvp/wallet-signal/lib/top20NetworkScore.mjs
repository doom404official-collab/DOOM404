import {validNetworkAddress,validNetworkSignature} from './holderNetworkTransfers.mjs';
// TOP20_NETWORK_V1 recovered unchanged from 0e5c25c / 159aa00 (2026-10-15).
// Source: 11314e2ff7d5e050592c6eae2b08ea76faa797a1/lib/top20NetworkScore.mjs.
// The input graph is derived here, never accepted as caller-asserted counts.
const clamp=x=>Math.max(0,Math.min(1,x));
const round=x=>Math.round(x*100)/100;
export function scoreTop20Network({holders,transfers,infrastructureWallets=[],supplyRaw}={}){
 if(!Array.isArray(holders)||holders.length<1||holders.length>20||!Array.isArray(transfers)||!Array.isArray(infrastructureWallets)||!infrastructureWallets.every(validNetworkAddress))throw Error('INVALID_NETWORK_INPUT');
 const exclusions=new Set(infrastructureWallets),balances=new Map(),rawBalances=new Map();
 const rawMode=supplyRaw!==undefined;
 if(rawMode&&(typeof supplyRaw!=="string"||!/^\d+$/.test(supplyRaw)||BigInt(supplyRaw)<=0n))throw Error("INVALID_NETWORK_SUPPLY");
 for(const h of holders){
  if(!validNetworkAddress(h?.wallet)||balances.has(h.wallet)||typeof h.sharePct!=='number'||!Number.isFinite(h.sharePct)||h.sharePct<0||h.sharePct>100)throw Error('INVALID_NETWORK_HOLDER');
  balances.set(h.wallet,h.sharePct);
  if(rawMode){if(typeof h.amountRaw!=="string"||!/^\d+$/.test(h.amountRaw))throw Error("INVALID_NETWORK_BALANCE");rawBalances.set(h.wallet,BigInt(h.amountRaw));}
 }
 if([...balances.values()].reduce((a,b)=>a+b,0)>100.000001)throw Error('INVALID_NETWORK_SUPPLY');
 if(rawMode&&[...rawBalances.values()].reduce((a,b)=>a+b,0n)>BigInt(supplyRaw))throw Error("INVALID_NETWORK_SUPPLY");
 const eligible=new Map([...balances].filter(([w])=>!exclusions.has(w)));
 if(!eligible.size)throw Error('NO_ELIGIBLE_NETWORK_HOLDERS');
 const verified=new Map();
 for(const e of transfers){
  if(e?.verifiedOnChain!==true||e?.transferVerified!==true||!validNetworkAddress(e.from)||!validNetworkAddress(e.to)||e.from===e.to||!validNetworkSignature(e.signature)||!Number.isSafeInteger(e.slot)||e.slot<0||!['SOL','SPL','TOKEN_2022'].includes(e.assetType)||typeof e.amountRaw!=='string'||!/^\d+$/.test(e.amountRaw)||BigInt(e.amountRaw)<=0n||(e.assetType!=='SOL'&&!validNetworkAddress(e.mint)))throw Error('INVALID_NETWORK_TRANSFER');
  const key=[e.signature,e.from,e.to,e.assetType,e.mint??'',e.amountRaw].join('|');verified.set(key,e);
 }
 const adjacency=new Map(),add=(g,a,b)=>{if(!g.has(a))g.set(a,new Set());g.get(a).add(b);};
 for(const e of verified.values()){add(adjacency,e.from,e.to);add(adjacency,e.to,e.from);}
 // Original policy: exclude high-degree hubs above 100 peers, not >=100.
 const hubs=new Set([...adjacency].filter(([,p])=>p.size>100).map(([w])=>w));
 const usable=[...verified.values()].filter(e=>!exclusions.has(e.from)&&!exclusions.has(e.to)&&!hubs.has(e.from)&&!hubs.has(e.to));
 const graph=new Map(),pairs=new Map();
 for(const e of usable){
  add(graph,e.from,e.to);add(graph,e.to,e.from);
  }
 // Original scorer counts eligible direct pairs before high-degree path filtering.
 for(const e of verified.values()){
  if(eligible.has(e.from)&&eligible.has(e.to)){
   const key=[e.from,e.to].sort().join('|');if(!pairs.has(key))pairs.set(key,new Set());pairs.get(key).add(e.signature);
  }
 }
 const visited=new Set(),clusters=[];
 for(const wallet of eligible.keys()){
  if(visited.has(wallet))continue;
  const queue=[wallet],members=[];visited.add(wallet);
  while(queue.length){const w=queue.pop();if(eligible.has(w))members.push(w);for(const peer of graph.get(w)??[])if(!visited.has(peer)){visited.add(peer);queue.push(peer);}}
  if(members.length>1){
   // Avoid accumulating rounded holder percentages; compute raw-backed exposure.
   const rawSum=rawMode?members.reduce((s,w)=>s+rawBalances.get(w),0n):0n;
   const sharePct=rawMode?Number((rawSum*20000n+BigInt(supplyRaw))/(2n*BigInt(supplyRaw)))/100:round(members.reduce((s,w)=>s+eligible.get(w),0));
   clusters.push({wallets:members.sort(),sharePct});
  }
 }
 const directPairs=pairs.size,repeatedPairs=[...pairs.values()].filter(s=>s.size>=3).length;
 const directHolders=new Set([...pairs.keys()].flatMap(k=>k.split('|'))).size;
 const connectedHolderCount=clusters.reduce((s,c)=>s+c.wallets.length,0);
 const indirectHolders=Math.max(0,connectedHolderCount-directHolders);
 const largestClusterPct=Math.max(0,...clusters.map(c=>c.sharePct));
 const penalties={direct:round(10*clamp(directPairs/15)),repeated:round(5*clamp(repeatedPairs/5)),indirect:round(5*clamp(indirectHolders/10)),concentration:round(15*clamp(largestClusterPct/35))};
 return {score:round(35-round(Object.values(penalties).reduce((a,b)=>a+b,0))),maxScore:35,penalties,
  evidence:{directPairs,repeatedPairs,directHolders,indirectHolders,largestClusterPct,connectedHolderCount,clusters,excludedHighDegreeHubCount:hubs.size},
  status:'observed_evidence',methodology:'TOP20_NETWORK_V1',calibrated:false,historyComplete:false,commonOwnershipEstablished:false,
  note:'Transactions indicate observed links, not shared control; incomplete history may understate links.'};
}

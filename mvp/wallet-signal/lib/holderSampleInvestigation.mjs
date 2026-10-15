// Read-only bounded investigation: sample top holders by token balance and optional verified creator.
// This is a sample, not a complete holder-network investigation.
import {discoverSolRelationships} from './historicalSolRelationships.mjs';
import {analyzeHolderNetwork} from './holderRelationshipNetwork.mjs';
import {summarizeHolderNetworkExposure} from './holderNetworkExposure.mjs';
export async function investigateHolderSample({rpcUrl,snapshot,creatorWallet=null,holderLimit=20,startIndex=0,batchSize=20,historyLimit=20,maxPages=2,discover=discoverSolRelationships}={}) {
 if(!rpcUrl||!snapshot||!Array.isArray(snapshot.holders)||!Number.isFinite(snapshot.circulatingSupply)||snapshot.circulatingSupply<=0)
  throw new TypeError('RPC URL and valid holder snapshot required');
 if(!Number.isInteger(holderLimit)||holderLimit<1||holderLimit>20||
    !Number.isInteger(historyLimit)||historyLimit<1||historyLimit>100||
    !Number.isInteger(startIndex)||startIndex<0||startIndex>19||
    !Number.isInteger(batchSize)||batchSize<1||batchSize>20)
  throw new TypeError('Invalid investigation limits');
 const sampled=[...snapshot.holders].filter(h=>h.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,holderLimit);
 const selected=sampled.slice(startIndex,startIndex+batchSize);
 const addresses=[...new Set([...selected.map(h=>h.wallet),...(creatorWallet?[creatorWallet]:[])])];
 const edges=[],coverage=[];
 const top20SupplyPct=Math.round(10000*sampled.reduce((s,h)=>s+h.balance,0)/snapshot.circulatingSupply)/100;
 for(const wallet of addresses){
  try {
   const result=await discover({rpcUrl,wallet,limit:historyLimit,maxPages});
   edges.push(...result.edges);
   coverage.push({wallet,success:true,...result.coverage});
  }catch(error){
   coverage.push({wallet,success:false,errorCode:'HISTORY_UNAVAILABLE'});
  }
 }
 const unique=[...new Map(edges.map(e=>[e.signature+'|'+e.from+'|'+e.to+'|'+e.assetType+'|'+(e.mint??''),e])).values()];
 const network=analyzeHolderNetwork({holders:snapshot.holders,creatorWallets:creatorWallet?[creatorWallet]:[],transfers:unique});
 const exposure=summarizeHolderNetworkExposure({holders:snapshot.holders,network,circulatingSupply:snapshot.circulatingSupply});
 const queried=new Set(coverage.filter(x=>x.success).map(x=>x.wallet));
 const top20HistoryCoverage=selected.filter(h=>queried.has(h.wallet)).length;
 return {methodology:'TOP_20_HOLDER_INDEPENDENCE_V1',top20SupplyPct,
  top20HistoryCoverage,top20TargetCount:Math.min(20,snapshot.holders.filter(h=>h.balance>0).length),
  sampledWalletCount:selected.length,startIndex,batchSize,queriedWalletCount:addresses.length,
  verifiedTransferCount:unique.length,network:{
   connectedHolderCount:network.connectedHolderCount,directHolderCount:network.directHolderCount,
   noDiscoveredConnectionCount:network.noDiscoveredConnectionCount,
   excludedHighDegreeHubCount:network.excludedHighDegreeHubCount
  },exposure:{connectedSupplyPct:exposure.connectedSupplyPct,creatorLinkedSupplyPct:exposure.creatorLinkedSupplyPct,
   largestClusterPct:exposure.largestClusterPct,creatorLinkedHolderCount:exposure.creatorLinkedHolderCount},
  coverage,assessmentStatus:'sample_only_not_final',
  note:'Only top holders and bounded transaction histories investigated; holders with no observed links are not independently verified.'};
}

// Read-only bounded investigation: sample top holders by token balance and optional verified creator.
// This is a sample, not a complete holder-network investigation.
import {discoverSolRelationships} from './historicalSolRelationships.mjs';
import {analyzeHolderNetwork} from './holderRelationshipNetwork.mjs';
import {summarizeHolderNetworkExposure} from './holderNetworkExposure.mjs';
export async function investigateHolderSample({rpcUrl,snapshot,creatorWallet=null,holderLimit=5,historyLimit=20,discover=discoverSolRelationships}={}) {
 if(!rpcUrl||!snapshot||!Array.isArray(snapshot.holders)||!Number.isFinite(snapshot.circulatingSupply)||snapshot.circulatingSupply<=0)
  throw new TypeError('RPC URL and valid holder snapshot required');
 if(!Number.isInteger(holderLimit)||holderLimit<1||holderLimit>20||
    !Number.isInteger(historyLimit)||historyLimit<1||historyLimit>100)
  throw new TypeError('Invalid investigation limits');
 const sampled=[...snapshot.holders].filter(h=>h.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,holderLimit);
 const addresses=[...new Set([...sampled.map(h=>h.wallet),...(creatorWallet?[creatorWallet]:[])])];
 const edges=[],coverage=[];
 for(const wallet of addresses){
  try {
   const result=await discover({rpcUrl,wallet,limit:historyLimit});
   edges.push(...result.edges);
   coverage.push({wallet,success:true,...result.coverage});
  }catch(error){
   coverage.push({wallet,success:false,errorCode:'HISTORY_UNAVAILABLE'});
  }
 }
 const unique=[...new Map(edges.map(e=>[e.signature+'|'+e.from+'|'+e.to+'|'+e.assetType+'|'+(e.mint??''),e])).values()];
 const network=analyzeHolderNetwork({holders:snapshot.holders,creatorWallets:creatorWallet?[creatorWallet]:[],transfers:unique});
 const exposure=summarizeHolderNetworkExposure({holders:snapshot.holders,network,circulatingSupply:snapshot.circulatingSupply});
 return {sampledWalletCount:sampled.length,queriedWalletCount:addresses.length,
  verifiedTransferCount:unique.length,network:{
   connectedHolderCount:network.connectedHolderCount,directHolderCount:network.directHolderCount,
   noDiscoveredConnectionCount:network.noDiscoveredConnectionCount,
   excludedHighDegreeHubCount:network.excludedHighDegreeHubCount
  },exposure:{connectedSupplyPct:exposure.connectedSupplyPct,creatorLinkedSupplyPct:exposure.creatorLinkedSupplyPct,
   largestClusterPct:exposure.largestClusterPct,creatorLinkedHolderCount:exposure.creatorLinkedHolderCount},
  coverage,assessmentStatus:'sample_only_not_final',
  note:'Only selected wallets and recent transactions investigated; unobserved connections remain possible.'};
}

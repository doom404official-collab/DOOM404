import {buildHolderConnectionGraph} from "./holderConnectionGraph.mjs";
/** Construct a verified-only graph from persisted evidence rows.
 * A completed evidence queue does not establish complete historical coverage.
 */
export function summarizeVerifiedHolderConnections({checkpoint,evidenceRows=[]}={}){
 if(!checkpoint||!Array.isArray(checkpoint.holders)||!checkpoint.wallets||!Array.isArray(evidenceRows))
  throw Error("INVALID_VERIFIED_CONNECTION_INPUT");
 const discovered=new Set(Object.values(checkpoint.edges||{}).flatMap(e=>e.signatures||[]));
 const records=new Map();
 for(const row of evidenceRows){
  if(!discovered.has(row?.signature)||records.has(row.signature))continue;
  records.set(row.signature,row);
 }
 const transactions=[];
 for(const [signature,row] of records){
  if(row.status!=="verified"||!Array.isArray(row.evidence?.pairs))continue;
  for(const key of row.evidence.pairs){
   if(typeof key!=="string")continue;
   const pair=key.split("|");
   if(pair.length!==2||pair[0]===pair[1]||!pair.every(w=>w in checkpoint.wallets))continue;
   transactions.push({signature,confirmed:true,directInteraction:true,participants:pair});
  }
 }
 const graph=buildHolderConnectionGraph({holders:checkpoint.holders,transactions,historyComplete:false});
 const counts={verified:0,rejected:0,pending:0,unavailable:0};
 for(const sig of discovered){
  const status=records.get(sig)?.status||"pending";
  counts[status in counts?status:"pending"]++;
 }
 const complete=counts.pending===0&&counts.unavailable===0;
 const pairs=graph.edges.map(e=>({...e,transferCount:e.signatures.length,
  strength:e.signatures.length>=2?"moderate":"weak"}));
 return {evidenceComplete:complete,historyComplete:false,signaturesTotal:discovered.size,
  counts,pairs,connectedGroups:graph.connectedGroups,connectedWallets:graph.connectedWalletCount,
  directPairs:pairs.length,commonOwnershipEstablished:false,
  caveat:"Verified transfers prove direct interactions, not common ownership or coordinated trading. Historical coverage is not established."};
}

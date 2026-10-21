import {scoreTop20Network} from "./top20NetworkScore.mjs";
/** Observed-only cross-job graph. Does not assert historical completeness or score promotion. */
export function summarizeFrozenCrossJobNetwork({snapshot,jobs=[]}={}){
 if(!snapshot||snapshot.status!=="frozen"||!Array.isArray(snapshot.holder_ranking)||snapshot.holder_ranking.length!==20||!Array.isArray(jobs)||!jobs.length)
  throw Error("INVALID_FROZEN_GRAPH_INPUT");
 const excluded=new Set(snapshot.excluded_wallets??[]);
 const supply=BigInt(snapshot.supply_raw);
 if(supply<=0n)throw Error("INVALID_FROZEN_SUPPLY");
 const holders=snapshot.holder_ranking.map(h=>{
  if(!h.wallet||!/^[0-9]+$/.test(String(h.balance)))throw Error("INVALID_FROZEN_HOLDER");
  const amountRaw=String(h.balance);
  return {wallet:h.wallet,amountRaw,sharePct:Number(BigInt(amountRaw)*1000000n/supply)/10000};
 });
 if(new Set(holders.map(h=>h.wallet)).size!==20||holders.some(h=>excluded.has(h.wallet)))throw Error("INVALID_ELIGIBLE_HOLDER_SET");
 const transfers=new Map(),sourceJobs=new Set(),unresolvedSignatures=new Set(),processedSignatures=new Set();
 for(const job of jobs){
  if(job.mint!==snapshot.mint||!job.checkpoint?.networkEvidence)throw Error("GRAPH_SOURCE_MISMATCH");
  sourceJobs.add(job.id);
  for(const [signature,p] of Object.entries(job.checkpoint.networkEvidence.processed??{})){
   processedSignatures.add(signature);
   if(p?.valid!==true||p?.unresolvedTokenTransfers!==0)unresolvedSignatures.add(signature);
  }
  for(const t of job.checkpoint.networkEvidence.transfers??[]){
   if(!t?.signature||!t.from||!t.to)throw Error("GRAPH_TRANSFER_INVALID");
   const key=[t.signature,t.from,t.to,t.assetType,t.mint??"",t.amountRaw].join("|");
   if(!transfers.has(key))transfers.set(key,t);
  }
 }
 const observed=scoreTop20Network({holders,transfers:[...transfers.values()],supplyRaw:snapshot.supply_raw,infrastructureWallets:[...excluded]});
 return {snapshotId:snapshot.id,sourceJobCount:sourceJobs.size,uniqueTransferRecords:transfers.size,
  observed,coverage:{uniqueProcessedSignatures:processedSignatures.size,uniqueUnresolvedSignatures:unresolvedSignatures.size,unresolvedEvidencePresent:unresolvedSignatures.size>0},historyComplete:false,finalScore:null,checkpointModified:false,scorePromoted:false,
  warning:"Cross-job observed evidence is not snapshot-time ownership proof or complete wallet history."};
}

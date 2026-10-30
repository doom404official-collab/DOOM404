import {scoreTop20Network} from './top20NetworkScore.mjs';
import {readFrozenHolderSnapshot} from './frozenHolderSnapshot.mjs';
import {holderNetworkSnapshotIdentity,NETWORK_RETENTION_LIMITS} from './holderNetworkCheckpoint.mjs';
import {validNetworkSignature} from './holderNetworkTransfers.mjs';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const economic=t=>JSON.stringify([t.signature,t.from,t.to,t.assetType,t.mint??'',t.amountRaw]);
const observation=t=>JSON.stringify([economic(t),t.slot]);
/** Observed-only reconciliation, never a checkpoint merge or provenance attestation. */
export function summarizeFrozenCrossJobNetwork({snapshot,jobs=[]}={}){
 const flags={historyComplete:false,finalScore:null,checkpointModified:false,scorePromoted:false,snapshotProvenanceVerified:false};
 const unavailable=reason=>({status:'unavailable',reason,observed:null,...flags});
 try{
  const {holders,snapshotIdentity}=readFrozenHolderSnapshot(snapshot);
  if(!Array.isArray(jobs)||!jobs.length)return unavailable('GRAPH_SOURCES_MISSING');
  const excluded=new Set(snapshot.excluded_wallets);
  if(holders.some(h=>excluded.has(h.wallet)))return unavailable('INVALID_ELIGIBLE_HOLDER_SET');
  const transfers=new Map(),sourceJobs=new Set(),processedSignatures=new Set(),pending=new Set(),failed=new Set(),signatureSets=new Map(),instructionObservations=new Map();
  let retainedTransferRecords=0,legacyInstructionRecords=0;
  const sources=[];
  for(const job of jobs){
   const cp=job?.checkpoint,e=cp?.networkEvidence;
   if(typeof job?.id!=='string'||!job.id||sourceJobs.has(job.id))return unavailable('GRAPH_SOURCE_IDENTITY_INVALID');
   if(job.mint!==snapshot.mint||cp?.mint!==snapshot.mint||cp.version!==1||!Array.isArray(cp.holders)||!object(cp.signatures))return unavailable('GRAPH_SOURCE_MISMATCH');
   if(cp.holders.length!==20||new Set(cp.holders.map(h=>h.ownerWallet)).size!==20||cp.holders.some(h=>!holders.some(f=>f.wallet===h.ownerWallet)))return unavailable('GRAPH_HOLDER_SET_MISMATCH');
   if(!e||e.version!==1||!object(e.processed)||!Array.isArray(e.transfers)||e.snapshotIdentity!==holderNetworkSnapshotIdentity(cp))return unavailable('GRAPH_RETAINED_IDENTITY_INVALID');
   if(e.retentionLimited!==false||Object.keys(e.processed).length>NETWORK_RETENTION_LIMITS.signatures||e.transfers.length>NETWORK_RETENTION_LIMITS.transfers)return unavailable('GRAPH_RETENTION_INCOMPLETE');
   const checked=Object.keys(cp.signatures).filter(s=>cp.signatures[s]==='checked');
   if(!checked.length||checked.length!==Object.keys(e.processed).length||Object.keys(e.processed).some(s=>cp.signatures[s]!=='checked'))return unavailable('GRAPH_CHECKED_EVIDENCE_MISSING');
   const groups=new Map();
   for(const [sig,state] of Object.entries(cp.signatures)){
    if(!validNetworkSignature(sig)||!['checked','pending','failed'].includes(state))return unavailable('GRAPH_SIGNATURE_STATE_INVALID');
    if(state==='pending')pending.add(sig);if(state==='failed')failed.add(sig);
   }
   for(const t of e.transfers){
    if(cp.signatures[t?.signature]!=='checked')return unavailable('GRAPH_TRANSFER_ORPHAN');
    if(!groups.has(t.signature))groups.set(t.signature,[]);groups.get(t.signature).push(t);
    const key=economic(t),old=transfers.get(key);
    if(old&&observation(old)!==observation(t))return unavailable('GRAPH_TRANSFER_CONFLICT');
    transfers.set(key,t);
    if(t.instructionId===undefined)legacyInstructionRecords++;
    else{
     if(typeof t.instructionId!=='string'||!t.instructionId.startsWith(t.signature+':'))return unavailable('GRAPH_INSTRUCTION_IDENTITY_INVALID');
     const prior=instructionObservations.get(t.instructionId);
     if(prior&&prior!==observation(t))return unavailable('GRAPH_INSTRUCTION_CONFLICT');
     instructionObservations.set(t.instructionId,observation(t));
    }
   }
   for(const sig of checked){
    const p=e.processed[sig],rows=groups.get(sig)??[];
    if(!object(p)||p.valid!==true||p.unresolvedTokenTransfers!==0)return unavailable('GRAPH_DECODE_UNRESOLVED');
    if(!Number.isSafeInteger(p.transferCount)||p.transferCount<0||p.transferCount!==rows.length)return unavailable('GRAPH_TRANSFER_COUNT_MISMATCH');
    const canonical=JSON.stringify([...new Set(rows.map(observation))].sort()),prior=signatureSets.get(sig);
    if(prior!==undefined&&prior!==canonical)return unavailable('GRAPH_SIGNATURE_OBSERVATION_CONFLICT');
    signatureSets.set(sig,canonical);processedSignatures.add(sig);
   }
   retainedTransferRecords+=e.transfers.length;sourceJobs.add(job.id);
   sources.push({id:job.id,version:job.version??null,updatedAt:job.updated_at??null,retainedSnapshotIdentity:e.snapshotIdentity});
  }
  if([...failed].some(s=>processedSignatures.has(s)||pending.has(s)))return unavailable('GRAPH_SIGNATURE_STATE_CONFLICT');
  const observed=scoreTop20Network({holders,transfers:[...transfers.values()],supplyRaw:snapshot.supply_raw,infrastructureWallets:[...excluded]});
  return {status:'OBSERVED_ONLY',snapshotId:snapshot.id,snapshotIdentity,sourceJobCount:sourceJobs.size,sources,uniqueTransferRecords:transfers.size,observed,
   coverage:{uniqueProcessedSignatures:processedSignatures.size,uniqueUnresolvedSignatures:0,unresolvedEvidencePresent:false,
    uniquePendingSignatures:[...pending].filter(s=>!processedSignatures.has(s)).length,uniqueFailedSignatures:failed.size,
    retainedTransferRecords,duplicateEconomicRecords:retainedTransferRecords-transfers.size,legacyInstructionRecords,
    instructionIdentityComplete:legacyInstructionRecords===0,atomicSourceSnapshot:false,sourceSnapshotAttachmentVerified:false,
    scope:'Observed transfers projected onto frozen balances; intermediary histories not independently scanned.'},...flags,
   warning:'Matching wallet sets and retained identities do not establish frozen snapshot provenance, transfer-time ownership of legacy records, or complete history.'};
 }catch{return unavailable('GRAPH_INPUT_OR_EVIDENCE_INVALID');}
}

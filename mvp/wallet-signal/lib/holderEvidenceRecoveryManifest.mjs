/** Read-only recovery inventory. No RPC calls, mutations, or score promotion. */
export function buildHolderEvidenceRecoveryManifest({jobs=[],validations=[]}={}){
 if(!Array.isArray(jobs)||!Array.isArray(validations))throw Error("INVALID_RECOVERY_INPUT");
 const byJob=new Map();
 for(const v of validations){
  if(typeof v?.job_id!=="string"||typeof v.signature!=="string")continue;
  const m=byJob.get(v.job_id)??new Map();
  m.set(v.signature,v.status);byJob.set(v.job_id,m);
 }
 const all=new Map(),perJob=[];
 for(const job of jobs){
  if(typeof job?.id!=="string"||!job.checkpoint||typeof job.checkpoint.signatures!=="object")throw Error("INVALID_RECOVERY_JOB");
  const cp=job.checkpoint,processed=cp.networkEvidence?.processed??{},verified=byJob.get(job.id)??new Map();
  const edges=new Set();
  for(const edge of Object.values(cp.edges??{}))for(const sig of edge.signatures??[])edges.add(sig);
  const counts={checked:0,networkRetained:0,legacyVerified:0,legacyPending:0,legacyEdgeUnvalidated:0,unclassifiedChecked:0};
  for(const [signature,state] of Object.entries(cp.signatures)){
   if(state!=="checked")continue;
   counts.checked++;
   let category;
   if(Object.hasOwn(processed,signature)&&processed[signature]?.valid===true&&processed[signature]?.unresolvedTokenTransfers===0)category="networkRetained";
   else if(verified.get(signature)==="verified")category="legacyVerified";
   else if(verified.get(signature)==="pending")category="legacyPending";
   else if(edges.has(signature))category="legacyEdgeUnvalidated";
   else category="unclassifiedChecked";
   counts[category]++;
   const record=all.get(signature)??{signature,jobIds:[],categories:[]};
   record.jobIds.push(job.id);record.categories.push(category);all.set(signature,record);
  }
  perJob.push({jobId:job.id,...counts});
 }
 const priority=["networkRetained","legacyVerified","legacyPending","legacyEdgeUnvalidated","unclassifiedChecked"];
 const unique=[...all.values()].map(r=>({...r,bestCategory:priority.find(p=>r.categories.includes(p))}));
 const totals=Object.fromEntries(priority.map(p=>[p,unique.filter(r=>r.bestCategory===p).length]));
 return {perJob,uniqueCheckedSignatures:unique.length,duplicateJobReferences:perJob.reduce((n,j)=>n+j.checked,0)-unique.length,totals,
  // No candidate is automatically authorized for retrieval.
  rpcRetrievalAuthorized:false,scorePromotionAuthorized:false,
  recoveryCandidates:unique.filter(r=>r.bestCategory!=="networkRetained"),
  note:"Legacy verification proves recorded direct edges, not absence of other transfers. Validate complete transaction-level evidence before any bounded retrieval."};
}

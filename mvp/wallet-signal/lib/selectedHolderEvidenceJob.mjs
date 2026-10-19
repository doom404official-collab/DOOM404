/**
 * Resolve the selector's exact investigation, never the most recently updated
 * row for its mint. Distinct holder sets are distinct historical investigations;
 * updated_at ordering cannot establish that a selected job is obsolete.
 * Missing, failed, unknown-status or inconsistent jobs need operator review.
 * This resolver does not retire jobs or substitute another job's checkpoint.
 */
export async function loadSelectedHolderEvidenceJob({selected,jobStore}={}){
 const nonempty=value=>typeof value==="string"&&value.trim().length>0;
 if(!nonempty(selected?.id)||!nonempty(selected?.mint))throw Error("EVIDENCE_SELECTION_INVALID");
 const job=await jobStore.getById(selected.id);
 if(!job)throw Error("EVIDENCE_JOB_NOT_FOUND");
 if(job.id!==selected.id||job.mint!==selected.mint)throw Error("EVIDENCE_JOB_IDENTITY_MISMATCH");
 if(!["queued","running","partial","complete"].includes(job.status))throw Error("EVIDENCE_JOB_NOT_ELIGIBLE");
 const checkpoint=job.checkpoint;
 if(!checkpoint||checkpoint.version!==1||checkpoint.mint!==job.mint||
  !Array.isArray(checkpoint.holders)||checkpoint.holders.length<1||checkpoint.holders.length>20||
  !checkpoint.wallets||typeof checkpoint.wallets!=="object"||Array.isArray(checkpoint.wallets))
  throw Error("EVIDENCE_CHECKPOINT_INVALID");
 if(!checkpoint.edges||typeof checkpoint.edges!=="object"||Array.isArray(checkpoint.edges)||
  Object.values(checkpoint.edges).some(edge=>!edge||typeof edge!=="object"||Array.isArray(edge)||
   !Array.isArray(edge.signatures)||edge.signatures.some(signature=>!nonempty(signature))))
  throw Error("EVIDENCE_CHECKPOINT_INVALID");
 const owners=checkpoint.holders.map(holder=>holder?.ownerWallet);
 const wallets=Object.keys(checkpoint.wallets);
 if(owners.some(owner=>!nonempty(owner))||wallets.length===0||
  wallets.some(wallet=>!owners.includes(wallet))||owners.some(owner=>!Object.hasOwn(checkpoint.wallets,owner)))
  throw Error("EVIDENCE_CHECKPOINT_INVALID");
 return job;
}

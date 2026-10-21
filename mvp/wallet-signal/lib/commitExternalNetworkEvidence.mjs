import {randomUUID} from "node:crypto";
import {prepareExternalNetworkMerge} from "./prepareExternalNetworkMerge.mjs";
/** Explicit, bounded merge under the existing holder lease. Never fetches RPC. */
export async function commitExternalNetworkEvidence({jobId,expectedMint,jobStore,evidenceStore,allowedSignatures,limit=3}={}){
 if(!jobId||!expectedMint||!jobStore||!evidenceStore||!Array.isArray(allowedSignatures)||allowedSignatures.length<1||allowedSignatures.length>3||new Set(allowedSignatures).size!==allowedSignatures.length||limit!==3)
  throw Error("NETWORK_MERGE_INVALID_REQUEST");
 const workerId=randomUUID();
 const claimed=await jobStore.claim(jobId,workerId,90);
 if(!claimed) return {status:"lease_unavailable",checkpointModified:false,scorePromoted:false};
 // A failed preparation leaves the short lease to expire; never write a stale checkpoint.
 if(claimed.id!==jobId||claimed.mint!==expectedMint||claimed.status!=="running")throw Error("NETWORK_MERGE_CLAIM_MISMATCH");
 const fresh=await jobStore.getById(jobId);
 if(!fresh||fresh.version!==claimed.version||fresh.mint!==expectedMint||fresh.status!=="running")
  throw Error("NETWORK_MERGE_VERSION_CHANGED");
 const rows=(await evidenceStore.listForJob(jobId)).filter(row=>allowedSignatures.includes(row.signature));
 if(rows.length!==allowedSignatures.length||new Set(rows.map(r=>r.signature)).size!==allowedSignatures.length)
  throw Error("NETWORK_MERGE_EVIDENCE_SET_CHANGED");
 const prepared=prepareExternalNetworkMerge({checkpoint:fresh.checkpoint,evidenceRows:rows});
 if(prepared.addedSignatures.length!==allowedSignatures.length)throw Error("NETWORK_MERGE_CANDIDATES_CHANGED");
 const committed=await jobStore.commit(jobId,workerId,fresh.version,prepared.checkpoint,fresh.summary,"partial");
 if(!committed||committed.id!==jobId||committed.version!==fresh.version+1)
  throw Error("NETWORK_MERGE_COMMIT_CONFLICT");
 return {status:"committed",addedSignatures:prepared.addedSignatures.length,addedTransfers:prepared.addedTransfers,
  version:committed.version,checkpointModified:true,scorePromoted:false};
}

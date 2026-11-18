import { prioritizeCreatorOriginCandidates } from './creatorOriginCandidatePriority.mjs';
import { verifyLaunchpadCreation } from './launchpadCreationVerifier.mjs';
import { pumpFunDecoders } from './pumpFunCreation.mjs';
/** Verify indexed creation candidates; indexed metadata alone is never attribution proof.
 * Uses the same budgeted RPC adapter as historical pagination.
 */
export async function investigateIndexedCreatorOrigin({mint,candidates=[],rpc,limit=10}={}){
 if(typeof rpc?.fetchTransaction!=='function')throw Error('INDEXED_ORIGIN_RPC_REQUIRED');
 const ranked=prioritizeCreatorOriginCandidates({mint,candidates,limit});
 const proofs=[],checked=[],deferred=[];
 for(const candidate of ranked){
  try{
   const tx=await rpc.fetchTransaction(candidate.signature);
   if(!tx){deferred.push(candidate.signature);continue;}
   checked.push(candidate.signature);
   const result=verifyLaunchpadCreation({mint,signature:candidate.signature,transaction:tx,decoders:pumpFunDecoders});
   if(result.status==='VERIFIED')proofs.push(...result.decodedRoles.map(role=>({
    signature:candidate.signature,creator:role.address,programId:role.programId,decoderVersion:role.decoderVersion
   })));
  }catch(error){
   deferred.push(candidate.signature);
   if(['CREATOR_REQUEST_BUDGET_EXHAUSTED','RPC_REQUEST_BUDGET_EXHAUSTED'].includes(error?.message))break;
  }
 }
 return {checked,deferred,proofs,historyComplete:false,source:'INDEXED_CANDIDATES_VERIFIED_ONCHAIN'};
}

import {verifyLaunchpadCreation} from './launchpadCreationVerifier.mjs';
import {pumpFunDecoders} from './pumpFunCreation.mjs';
/** Independently re-fetch creation transaction and compare the decoded creator.
 * Does not establish the natural person or beneficial owner.
 */
export async function recheckCreatorOrigin({mint,evidence=[],rpc,verifyCreation=verifyLaunchpadCreation,decoders=pumpFunDecoders}={}){
 if(typeof rpc?.fetchTransaction!=='function'||!Array.isArray(evidence))throw Error('INVALID_ORIGIN_RECHECK');
 const first=evidence[0];
 if(!first?.signature||!first?.creator)return {status:'UNRESOLVED',rechecked:false};
 const transaction=await rpc.fetchTransaction(first.signature);
 if(!transaction)return {status:'TRANSACTION_UNAVAILABLE',rechecked:false};
 const proof=verifyCreation({mint,signature:first.signature,transaction,decoders});
 const matches=proof.status==='VERIFIED'&&proof.decodedRoles.some(x=>
  x.address===first.creator&&x.programId===first.programId&&x.decoderVersion===first.decoderVersion);
 return {status:matches?'ONCHAIN_CREATOR_RECHECKED':'ATTRIBUTION_MISMATCH',
  rechecked:matches,creator:matches?first.creator:null,signature:first.signature,
  beneficialOwnerVerified:false};
}

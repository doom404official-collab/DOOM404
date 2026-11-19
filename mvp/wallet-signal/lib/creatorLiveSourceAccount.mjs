import {verifyCreatorSourceTokenAccount} from './creatorSourceTokenAccount.mjs';
/** Read-only finalized RPC source-account verification.
 * Current state does not prove historical ownership at transaction slot.
 */
export async function verifyLiveCreatorSourceAccount({mint,creator,tokenAccount,rpc}={}){
 if(typeof rpc?.getParsedAccountInfo!=='function')throw Error('CREATOR_SOURCE_RPC_REQUIRED');
 const accountInfo=await rpc.getParsedAccountInfo(tokenAccount);
 const result=verifyCreatorSourceTokenAccount({mint,creator,tokenAccount,accountInfo});
 return {...result,historicalOwnershipVerified:false,
  observation:'CURRENT_FINALIZED_ACCOUNT_STATE'};
}

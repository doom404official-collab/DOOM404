import {verifyPumpFunPoolTokenAccountState} from './pumpFunPoolAccountState.mjs';
/** Read-only, budgeted verification of current Pump.fun pool token-account state.
 * Current state is not proof of historical ownership at transaction slot.
 */
export async function verifyLivePumpFunPoolAccount({mint,poolTokenAccount,rpc}={}){
 if(typeof rpc?.getParsedAccountInfo!=='function')throw Error('POOL_RPC_ADAPTER_REQUIRED');
 const accountInfo=await rpc.getParsedAccountInfo(poolTokenAccount);
 const result=verifyPumpFunPoolTokenAccountState({mint,poolTokenAccount,accountInfo});
 return {...result,historicalOwnershipVerified:false,
  observation:'CURRENT_FINALIZED_ACCOUNT_STATE'};
}

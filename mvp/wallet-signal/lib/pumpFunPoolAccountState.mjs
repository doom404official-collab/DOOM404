import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
/** Verify a parsed SPL token account matches the Pump.fun bonding curve owner and mint.
 * Caller supplies fresh RPC account data; missing data never passes.
 */
export function verifyPumpFunPoolTokenAccountState({mint,poolTokenAccount,accountInfo}={}){
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(derived.status!=='DERIVED'||poolTokenAccount!==derived.poolTokenAccount)
 return {status:'UNVERIFIED',reason:'POOL_ADDRESS_MISMATCH'};
 const parsed=accountInfo?.value?.data?.parsed;
 const info=parsed?.info;
 if(parsed?.type!=='account'||info?.mint!==mint||info?.owner!==derived.bondingCurve)
 return {status:'UNVERIFIED',reason:'TOKEN_ACCOUNT_STATE_MISMATCH'};
 return {status:'POOL_TOKEN_ACCOUNT_VERIFIED',poolTokenAccount,mint,
  bondingCurve:derived.bondingCurve,ownershipVerified:true};
}

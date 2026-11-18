import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
import {identifyPumpFunPoolTokenAccount} from './pumpFunPoolAccountResolver.mjs';
/** Validate legacy Pump.fun pool accounts against independently derived addresses.
 * Does not claim account-state ownership without RPC account data.
 */
export function comparePumpFunPoolAccounts({mint,transaction,instruction}={}){
 const candidate=identifyPumpFunPoolTokenAccount({mint,transaction,instruction});
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(candidate.status!=='LAYOUT_CANDIDATE'||derived.status!=='DERIVED')
 return {status:'UNVERIFIED',reason:'POOL_ACCOUNT_CANDIDATE_MISSING'};
 const match=candidate.poolTokenAccount===derived.poolTokenAccount;
 return {status:match?'POOL_ADDRESS_MATCH':'POOL_ADDRESS_MISMATCH',
  poolTokenAccount:candidate.poolTokenAccount,bondingCurve:derived.bondingCurve,
  derivationVerified:match,ownershipVerified:false};
}

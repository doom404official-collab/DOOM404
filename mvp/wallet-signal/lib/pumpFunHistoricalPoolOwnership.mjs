import {resolveTokenBalanceAccounts} from './solanaTokenBalanceAccountResolver.mjs';
import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
/** Verify historical pool ATA ownership using sale-transaction token balance metadata.
 * Missing historical owner fields are unknown, not inferred from current RPC state.
 */
export function verifyHistoricalPumpFunPoolOwnership({mint,transaction}={}){
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(derived.status!=='DERIVED'||!transaction||transaction.meta?.err!=null)
 return {status:'UNVERIFIED',reason:'INVALID_INPUT'};
 const resolved=resolveTokenBalanceAccounts({transaction});
 const balances=[...resolved.pre,...resolved.post].filter(x=>
  x.accountPubkey===derived.poolTokenAccount&&x.mint===mint);
 if(!balances.length)return {status:'UNVERIFIED',reason:'HISTORICAL_POOL_BALANCE_MISSING'};
 if(balances.some(x=>x.owner!==derived.bondingCurve))
 return {status:'UNVERIFIED',reason:'HISTORICAL_POOL_OWNER_MISSING_OR_MISMATCH'};
 return {status:'HISTORICAL_POOL_OWNER_VERIFIED',poolTokenAccount:derived.poolTokenAccount,
  bondingCurve:derived.bondingCurve,historicalOwnershipVerified:true};
}

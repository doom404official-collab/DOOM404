import {resolveTokenBalanceAccounts} from './solanaTokenBalanceAccountResolver.mjs';
/** Establish historical source token-account owner from sale transaction token balances.
 * Missing owner metadata is unknown, never inferred from current account state.
 */
export function verifyHistoricalCreatorSourceAccount({transaction,mint,creator,tokenAccount}={}){
 if(!transaction||transaction.meta?.err!=null||!mint||!creator||!tokenAccount)
 return {status:'UNVERIFIED',reason:'INVALID_INPUT'};
 const resolved=resolveTokenBalanceAccounts({transaction});
 const records=[...resolved.pre,...resolved.post].filter(x=>x.accountPubkey===tokenAccount&&x.mint===mint);
 if(!records.length)return {status:'UNVERIFIED',reason:'HISTORICAL_TOKEN_BALANCE_NOT_FOUND'};
 if(records.some(x=>x.owner!==creator))
 return {status:'UNVERIFIED',reason:'HISTORICAL_OWNER_MISMATCH_OR_MISSING'};
 return {status:'HISTORICAL_CREATOR_SOURCE_VERIFIED',tokenAccount,mint,creator,
  historicalOwnershipVerified:true,accountIndexResolved:true};
}

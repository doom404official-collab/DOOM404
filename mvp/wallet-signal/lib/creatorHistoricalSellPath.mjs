import {corroboratePumpFunSellTokenPath} from './pumpFunSellTokenPath.mjs';
import {verifyHistoricalCreatorSourceAccount} from './creatorHistoricalSourceOwnership.mjs';
/** Require historical owner metadata for every source token account before
 * accepting a sell-linked creator-to-pool transfer path.
 * This is still corroboration, not verified swap settlement.
 */
export function corroborateHistoricalCreatorSellPath({mint,creator,transaction}={}){
 const {matches}=corroboratePumpFunSellTokenPath({mint,transaction,creatorTokenAccounts:
  [...new Set((transaction?.meta?.preTokenBalances||[]).concat(transaction?.meta?.postTokenBalances||[])
   .filter(x=>x?.mint===mint&&x?.owner===creator)
   .map(x=>{const keys=transaction?.transaction?.message?.accountKeys||[];
    const key=keys[x.accountIndex];return typeof key==='string'?key:key?.pubkey?.toString?.();})
   .filter(Boolean))]});
 const verified=matches.filter(match=>verifyHistoricalCreatorSourceAccount({
  transaction,mint,creator,tokenAccount:match.source}).historicalOwnershipVerified===true);
 return {status:verified.length?'HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED':'UNVERIFIED',
  matches:verified,settlementVerified:false};
}

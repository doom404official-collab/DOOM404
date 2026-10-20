import {groupPumpFunBuyInstructions} from './pumpFunBuyInstructionGroups.mjs';
import {resolveTokenBalanceAccounts} from './solanaTokenBalanceAccountResolver.mjs';
/** Corroborate creator token receipt within a single Pump.fun buy group.
 * Actual SOL payment and pool identity remain separate requirements.
 */
export function observePumpFunCreatorBuyReceipt({mint,creator,transaction}={}){
 const resolved=resolveTokenBalanceAccounts({transaction});
 const owned=new Map();
 for(const row of [...resolved.pre,...resolved.post]){
  if(row.mint!==mint||!row.accountPubkey)continue;
  const prior=owned.get(row.accountPubkey);
  if(prior&&prior!==row.owner)owned.set(row.accountPubkey,null);
  else if(!owned.has(row.accountPubkey))owned.set(row.accountPubkey,row.owner||null);
 }
 const results=[];
 for(const group of groupPumpFunBuyInstructions({transaction})){
  for(const ix of group.innerInstructions){
   const info=ix?.parsed?.info;
   if(!['spl-token','spl-token-2022'].includes(ix?.program)||
    !['transfer','transferChecked'].includes(ix?.parsed?.type)||
    !info?.destination||!info?.source||info.mint&&info.mint!==mint||
    owned.get(info.destination)!==creator)continue;
   const amount=String(info.tokenAmount?.amount??info.amount??'');
   if(!/^[0-9]+$/.test(amount)||BigInt(amount)<=0n)continue;
   results.push({instructionIndex:group.instructionIndex,sourceTokenAccount:info.source,
    buyerTokenAccount:info.destination,amountRaw:amount,requestedTokenRaw:group.requestedTokenRaw,
    historicalBuyerOwnershipVerified:true,tokenReceiptObserved:true,
    poolSourceVerified:false,solPaymentVerified:false,purchaseVerified:false});
  }
 }
 return results;
}

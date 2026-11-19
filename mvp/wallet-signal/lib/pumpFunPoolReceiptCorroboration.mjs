import {comparePumpFunPoolAccounts} from './pumpFunPoolAccountComparison.mjs';
import {observePumpFunPoolTokenSettlement} from './pumpFunPoolTokenObservation.mjs';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
/** Correlate one Pump.fun instruction with derived pool ATA and same-tx token receipt.
 * Current pool ownership and instruction-level settlement remain separate checks.
 */
export function corroboratePumpFunPoolReceipt({mint,transaction}={}){
 if(!transaction||transaction.meta?.err!=null)return {status:'UNVERIFIED',reason:'INVALID_TRANSACTION'};
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const instructions=[...(transaction.transaction?.message?.instructions||[]),
  ...(transaction.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 for(const ix of instructions){
  const programId=ix.programId||(Number.isInteger(ix.programIdIndex)?keys[ix.programIdIndex]:null);
  if(programId!==PUMP_FUN_PROGRAM_ID)continue;
  const comparison=comparePumpFunPoolAccounts({mint,transaction,instruction:ix});
  if(comparison.status!=='POOL_ADDRESS_MATCH')continue;
  const receipt=observePumpFunPoolTokenSettlement({transaction,mint,poolTokenAccounts:[comparison.poolTokenAccount]});
  if(receipt.status!=='POOL_TOKEN_RECEIPT_OBSERVED')continue;
  return {status:'POOL_RECEIPT_CORROBORATED',poolTokenAccount:comparison.poolTokenAccount,
   poolReceivedRaw:receipt.poolReceivedRaw,ownershipVerified:false,
   linkedToSpecificSellInstruction:false,settlementVerified:false};
 }
 return {status:'UNVERIFIED',reason:'POOL_RECEIPT_NOT_CORROBORATED'};
}

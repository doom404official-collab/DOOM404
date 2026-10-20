import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
import {verifyHistoricalPumpFunPoolOwnership} from './pumpFunHistoricalPoolOwnership.mjs';
import {observePumpFunCreatorBuyReceipt} from './pumpFunCreatorBuyReceipt.mjs';
import {groupPumpFunBuyInstructions} from './pumpFunBuyInstructionGroups.mjs';
/** Corroborate creator buy settlement against historical pool ATA and same-group SOL payment.
 * Does not independently verify the transaction's balance deltas or fee reconciliation.
 */
export function corroboratePumpFunCreatorBuySettlement({mint,creator,transaction}={}){
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(derived.status!=='DERIVED')return [];
 const ownership=verifyHistoricalPumpFunPoolOwnership({mint,transaction});
 if(ownership.historicalOwnershipVerified!==true)return [];
 const receipts=observePumpFunCreatorBuyReceipt({mint,creator,transaction});
 return groupPumpFunBuyInstructions({transaction}).flatMap(group=>{
  const matching=receipts.filter(x=>x.instructionIndex===group.instructionIndex&&
   x.sourceTokenAccount===derived.poolTokenAccount);
  const payments=group.innerInstructions.filter(ix=>ix?.program==='system'&&ix?.parsed?.type==='transfer'&&
   ix.parsed.info?.source===creator&&ix.parsed.info?.destination===derived.bondingCurve&&
   Number.isSafeInteger(ix.parsed.info?.lamports)&&ix.parsed.info.lamports>0);
  if(matching.length!==1||payments.length!==1)return [];
  return [{instructionIndex:group.instructionIndex,creator,mint,
   amountRaw:matching[0].amountRaw,solPaidLamports:String(payments[0].parsed.info.lamports),
   poolOwnershipVerified:true,buyerOwnershipVerified:true,tokenReceiptObserved:true,
   solPaymentObserved:true,settlementVerified:false,independentlyVerified:false}];
 });
}

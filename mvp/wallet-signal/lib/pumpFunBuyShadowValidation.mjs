import {extractIndependentPumpFunBuySettlement} from './pumpFunIndependentBuySettlement.mjs';
import {reconcilePumpFunCreatorBuy} from './pumpFunCreatorBuyReconciliation.mjs';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
import {groupPumpFunBuyInstructions} from './pumpFunBuyInstructionGroups.mjs';
import {promotePumpFunCreatorBuy} from './pumpFunCreatorBuyPromotion.mjs';
/** Shadow-mode buy verification for live historical transactions.
 * Never promotes events or changes creator acquisition ledger automatically.
 */
export function inspectPumpFunBuyShadow({mint,creator,signature,transaction}={}){
 const settlement=extractIndependentPumpFunBuySettlement({mint,creator,signature,transaction});
 if(!settlement){
  const groups=groupPumpFunBuyInstructions({transaction});
  const reconciliation=groups.length?reconcilePumpFunCreatorBuy({mint,creator,transaction}):null;
  return {signature,status:'NO_VERIFIED_BUY_EVIDENCE',purchaseVerified:false,
   diagnostic:groups.length===0?(transaction?.transaction?.message?.instructions||[]).some(ix=>{const keys=transaction?.transaction?.message?.accountKeys||[];const key=Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null;return ix?.programId===PUMP_FUN_PROGRAM_ID||(typeof key==='string'?key:key?.pubkey?.toString?.())===PUMP_FUN_PROGRAM_ID;})?'PUMP_FUN_INSTRUCTION_UNRECOGNIZED':'NO_PUMP_FUN_BUY_INSTRUCTION':
    reconciliation?.status==='BALANCES_CORROBORATED'?'INDEPENDENT_SETTLEMENT_MISSING':
    reconciliation?.reason||'BUY_RECONCILIATION_UNVERIFIED'};
 }
 const promoted=promotePumpFunCreatorBuy({mint,creator,signature,transaction,independentSettlement:settlement});
 return {signature,status:promoted.status==='VERIFIED'?'SHADOW_VERIFIED_BUY':'SHADOW_REJECTED',
  purchaseVerified:false,eligibleForLivePromotion:false,
  evidence:promoted.status==='VERIFIED'?{instructionIndex:promoted.event.instructionIndex,
   amountRaw:promoted.event.amountRaw,decoderVersion:settlement.decoderVersion}:null};
}

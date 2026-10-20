import {extractIndependentPumpFunBuySettlement} from './pumpFunIndependentBuySettlement.mjs';
import {promotePumpFunCreatorBuy} from './pumpFunCreatorBuyPromotion.mjs';
/** Shadow-mode buy verification for live historical transactions.
 * Never promotes events or changes creator acquisition ledger automatically.
 */
export function inspectPumpFunBuyShadow({mint,creator,signature,transaction}={}){
 const settlement=extractIndependentPumpFunBuySettlement({mint,creator,signature,transaction});
 if(!settlement)return {signature,status:'NO_VERIFIED_BUY_EVIDENCE',purchaseVerified:false};
 const promoted=promotePumpFunCreatorBuy({mint,creator,signature,transaction,independentSettlement:settlement});
 return {signature,status:promoted.status==='VERIFIED'?'SHADOW_VERIFIED_BUY':'SHADOW_REJECTED',
  purchaseVerified:false,eligibleForLivePromotion:false,
  evidence:promoted.status==='VERIFIED'?{instructionIndex:promoted.event.instructionIndex,
   amountRaw:promoted.event.amountRaw,decoderVersion:settlement.decoderVersion}:null};
}

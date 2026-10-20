import {reconcilePumpFunCreatorBuy} from './pumpFunCreatorBuyReconciliation.mjs';
import {classifyVerifiedCreatorAcquisition} from './creatorVerifiedAcquisitionClassifier.mjs';
/** Convert a corroborated Pump.fun buy into a ledger event only when independent
 * protocol settlement evidence has separately been established.
 */
export function promotePumpFunCreatorBuy({mint,creator,signature,transaction,independentSettlement}={}){
 const reconciled=reconcilePumpFunCreatorBuy({mint,creator,transaction});
 if(reconciled.status!=='BALANCES_CORROBORATED')return {status:'UNVERIFIED',event:null};
 if(!independentSettlement||independentSettlement.signature!==signature||
  independentSettlement.instructionIndex!==reconciled.instructionIndex||
  independentSettlement.mint!==mint||independentSettlement.creator!==creator||
  independentSettlement.amountRaw!==reconciled.amountRaw||
  independentSettlement.solPaidLamports!==reconciled.solPaidLamports||
  independentSettlement.protocolVerified!==true||
  independentSettlement.settlementVerified!==true||
  independentSettlement.independentlyVerified!==true)
 return {status:'UNVERIFIED',event:null};
 const observation={signature,instructionIndex:reconciled.instructionIndex,
  mint,creator,amountRaw:reconciled.amountRaw};
 const proof={...independentSettlement,type:'PURCHASE',instructionVerified:true};
 return classifyVerifiedCreatorAcquisition({mint,creator,observation,proof});
}

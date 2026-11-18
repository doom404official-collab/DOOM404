import {reconcilePumpFunCreatorBuy} from './pumpFunCreatorBuyReconciliation.mjs';
import {groupPumpFunBuyInstructions} from './pumpFunBuyInstructionGroups.mjs';
import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
/** Derive a conservative independent buy settlement candidate from transaction data.
 * Restricts to single-instruction buys with exact fee-adjusted balance reconciliation.
 */
export function extractIndependentPumpFunBuySettlement({mint,creator,signature,transaction}={}){
 const reconciled=reconcilePumpFunCreatorBuy({mint,creator,transaction});
 if(reconciled.status!=='BALANCES_CORROBORATED')return null;
 const groups=groupPumpFunBuyInstructions({transaction});
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(groups.length!==1||derived.status!=='DERIVED'||!Number.isSafeInteger(transaction?.blockTime)||
  transaction.blockTime<=0)return null;
 const group=groups[0];
 const tokenTransfers=group.innerInstructions.filter(ix=>
  ['spl-token','spl-token-2022'].includes(ix?.program)&&
  ['transfer','transferChecked'].includes(ix?.parsed?.type)&&
  ix.parsed.info?.source===derived.poolTokenAccount&&
  ix.parsed.info?.mint===mint&&
  String(ix.parsed.info?.tokenAmount?.amount??ix.parsed.info?.amount)===reconciled.amountRaw);
 const payments=group.innerInstructions.filter(ix=>ix?.program==='system'&&
  ix?.parsed?.type==='transfer'&&ix.parsed.info?.source===creator&&
  ix.parsed.info?.destination===derived.bondingCurve&&
  String(ix.parsed.info?.lamports)===reconciled.solPaidLamports);
 if(tokenTransfers.length!==1||payments.length!==1)return null;
 return {signature,instructionIndex:reconciled.instructionIndex,mint,creator,
  amountRaw:reconciled.amountRaw,solPaidLamports:reconciled.solPaidLamports,
  timestamp:transaction.blockTime,protocolVerified:true,settlementVerified:true,
  independentlyVerified:true,decoderVersion:'pump-fun-buy-linked-settlement-v1'};
}

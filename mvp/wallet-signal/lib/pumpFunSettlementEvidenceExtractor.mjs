import {groupPumpFunSellInnerInstructions} from './pumpFunSellInnerInstructionGroups.mjs';
import {derivePumpFunBondingCurveAccounts} from './pumpFunBondingCurveDerivation.mjs';
import {corroborateHistoricalCreatorSellPath} from './creatorHistoricalSellPath.mjs';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
/** Extract transaction-local settlement evidence from a single sell instruction group.
 * Does not assert historical pool ownership without an independently validated account state.
 */
export function extractPumpFunSettlementEvidence({mint,creator,signature,transaction}={}){
 const derived=derivePumpFunBondingCurveAccounts({mint});
 if(derived.status!=='DERIVED')return null;
 const path=corroborateHistoricalCreatorSellPath({mint,creator,transaction});
 if(path.status!=='HISTORICAL_CREATOR_TOKEN_PATH_CORROBORATED')return null;
 for(const group of groupPumpFunSellInnerInstructions({transaction})){
  const matches=path.matches.filter(x=>x.outerInstructionIndex===group.outerInstructionIndex&&
   x.destination===derived.poolTokenAccount&&x.amountRaw===group.soldRaw);
  if(matches.length!==1)continue;
  const payments=group.innerInstructions.filter(ix=>ix?.program==='system'&&ix?.parsed?.type==='transfer'&&
   ix.parsed.info?.source===derived.bondingCurve&&ix.parsed.info?.destination===creator&&
   Number.isSafeInteger(ix.parsed.info?.lamports)&&ix.parsed.info.lamports>0);
  if(payments.length!==1)continue;
  return {independentlyDecoded:false,signature,mint,creator,programId:PUMP_FUN_PROGRAM_ID,
   instructionType:'SELL',soldRaw:group.soldRaw,creatorReceivedLamports:String(payments[0].parsed.info.lamports),
   timestamp:transaction.blockTime,decoderVersion:'pump-fun-linked-settlement-v1',
   poolTokenReceiptVerified:false,creatorSolReceiptVerified:true,outputAsset:'SOL',
   sourceOwnershipVerified:true,transactionInstructionLinked:true,
   historicalPoolOwnershipVerified:false};
 }
 return null;
}

import {decodePumpFunSellInstruction} from './pumpFunSellInstruction.mjs';
import {corroborateCreatorSellFlows} from './creatorSellFlowCorroboration.mjs';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
/** Conservative Pump.fun legacy creator sell verifier.
 * Requires instruction payload, signer, mint-bound token outflow and positive net SOL.
 * Positive SOL delta is supporting evidence, not independent proof of pool payment.
 */
export function verifyPumpFunCreatorSellCandidate({mint,creator,signature,transaction}={}){
 if(!transaction||transaction.meta?.err!=null)return {status:'UNVERIFIED',reason:'INVALID_TRANSACTION'};
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const instructions=[...(transaction.transaction?.message?.instructions||[]),
  ...(transaction.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 for(const ix of instructions){
  const programId=ix.programId||(Number.isInteger(ix.programIdIndex)?keys[ix.programIdIndex]:null);
  if(programId!==PUMP_FUN_PROGRAM_ID)continue;
  const payload=decodePumpFunSellInstruction({instruction:ix,programId});
  if(!payload)continue;
  const flow=corroborateCreatorSellFlows({transaction,creator,mint,claimedSoldRaw:payload.soldRaw});
  if(flow.status!=='FLOW_OBSERVED')continue;
  if(flow.netSolLamports<=0)return {status:'UNVERIFIED',reason:'NO_POSITIVE_NET_SOL_RECEIPT'};
  return {status:'CORROBORATED_CANDIDATE',signature,creator,mint,soldRaw:payload.soldRaw,
   netSolLamports:flow.netSolLamports,protocolInstructionVerified:false,
   outputAssetVerified:false,saleVerified:false,
   reason:'POOL_SETTLEMENT_NOT_INDEPENDENTLY_VERIFIED'};
 }
 return {status:'UNVERIFIED',reason:'NO_CORROBORATED_PUMP_FUN_SELL'};
}

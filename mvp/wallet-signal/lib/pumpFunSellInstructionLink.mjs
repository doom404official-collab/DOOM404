import {decodePumpFunSellInstruction} from './pumpFunSellInstruction.mjs';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
/** Identify an individual Pump.fun sell instruction and its outer instruction index.
 * Transaction-wide balance deltas are not instruction-specific settlement proof.
 */
export function locatePumpFunSellInstructions({transaction}={}){
 if(!transaction||transaction.meta?.err!=null)return [];
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const outer=transaction.transaction?.message?.instructions||[];
 return outer.flatMap((ix,index)=>{
  const programId=ix.programId||(Number.isInteger(ix.programIdIndex)?keys[ix.programIdIndex]:null);
  if(programId!==PUMP_FUN_PROGRAM_ID)return [];
  const payload=decodePumpFunSellInstruction({instruction:ix,programId});
  return payload?[{outerInstructionIndex:index,soldRaw:payload.soldRaw,
   decoderVersion:payload.decoderVersion,settlementVerified:false}]:[];
 });
}

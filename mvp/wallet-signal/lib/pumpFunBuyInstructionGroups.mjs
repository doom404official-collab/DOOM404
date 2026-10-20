import {decodePumpFunBuyInstruction} from './pumpFunBuyInstruction.mjs';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
/** Locate legacy Pump.fun buy instructions and their exact inner instruction groups.
 * Instruction payloads are candidates, not verified acquisitions.
 */
export function groupPumpFunBuyInstructions({transaction}={}){
 if(!transaction||transaction.meta?.err!=null)return [];
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const outer=transaction.transaction?.message?.instructions||[];
 return outer.flatMap((ix,instructionIndex)=>{
  const programId=ix.programId||(Number.isInteger(ix.programIdIndex)?keys[ix.programIdIndex]:null);
  const payload=decodePumpFunBuyInstruction({instruction:ix,programId});
  if(!payload||programId!==PUMP_FUN_PROGRAM_ID)return [];
  const group=(transaction.meta?.innerInstructions||[]).find(g=>g.index===instructionIndex);
  return [{instructionIndex,requestedTokenRaw:payload.requestedTokenRaw,
   maxSolCostLamports:payload.maxSolCostLamports,
   innerInstructions:Array.isArray(group?.instructions)?group.instructions:[],
   instructionGroupFound:Boolean(group),purchaseVerified:false}];
 });
}

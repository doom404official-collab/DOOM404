/** Identify Pump.fun instructions for later protocol-specific sell verification.
 * Presence of a Pump.fun instruction alone never proves a sale.
 */
export const PUMP_FUN_PROGRAM_ID='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export function identifyPumpFunInstructionCandidates({transaction}={}){
 if(!transaction||transaction.meta?.err!=null)return [];
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const instructions=[...(transaction.transaction?.message?.instructions||[]),
  ...(transaction.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
 return instructions.flatMap((ix,index)=>{
  const programId=ix.programId||(Number.isInteger(ix.programIdIndex)?keys[ix.programIdIndex]:null);
  if(programId!==PUMP_FUN_PROGRAM_ID)return [];
  return [{instructionIndex:index,programId,classification:'UNVERIFIED_PUMP_FUN_INSTRUCTION',
   saleVerified:false,soldRaw:null}];
 });
}

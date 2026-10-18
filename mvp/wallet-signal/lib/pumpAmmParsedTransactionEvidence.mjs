import {classifyPumpAmmInstruction} from "./pumpAmmInstructionEvidence.mjs";
export function inspectPumpAmmParsedTransaction(tx,poolAddress) {
 if(!tx)return {status:"unavailable",candidateOperations:[],withdrawalConfirmed:false};
 if(tx.meta?.err)return {status:"failed_transaction",candidateOperations:[],withdrawalConfirmed:false};
 const keys=tx.transaction?.message?.staticAccountKeys??tx.transaction?.message?.accountKeys??[];
 const keyStrings=keys.map(k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k));
 const instructions=tx.transaction?.message?.compiledInstructions??tx.transaction?.message?.instructions??[];
 const candidateOperations=[];
 for(const ix of instructions){
  const program=ix.programId?.toBase58?.()??keyStrings[ix.programIdIndex]??"";
  const data=ix.data instanceof Uint8Array?Buffer.from(ix.data):null;
  const result=classifyPumpAmmInstruction(program,data);
  if(!result.candidate)continue;
  const indices=ix.accountKeyIndexes??ix.accounts??[];
  const poolMatched=indices.some(i=>typeof i==="number"&&keyStrings[i]===poolAddress);
  candidateOperations.push({operation:result.candidate,poolMatched,verified:false});
 }
 return {status:"candidate_only",candidateOperations,withdrawalConfirmed:false,tokenBalanceCorroborated:false};
}

import {classifyPumpAmmInstruction} from "./pumpAmmInstructionEvidence.mjs";
const asKey=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k);
export function inspectPumpAmmParsedTransaction(tx,poolAddress) {
 if(!tx)return {status:"unavailable",candidateOperations:[],withdrawalConfirmed:false};
 if(tx.meta?.err)return {status:"failed_transaction",candidateOperations:[],withdrawalConfirmed:false};
 const message=tx.transaction?.message;
 const keys=[...(message?.staticAccountKeys??message?.accountKeys??[]),...(tx.meta?.loadedAddresses?.writable??[]),...(tx.meta?.loadedAddresses?.readonly??[])].map(asKey);
 const outer=message?.compiledInstructions??message?.instructions??[];
 const inner=(tx.meta?.innerInstructions??[]).flatMap(group=>group.instructions??[]);
 const candidateOperations=[];
 for(const [source,instructions] of [["outer",outer],["inner",inner]]){
  for(const ix of instructions){
   const program=ix.programId?.toBase58?.()??keys[ix.programIdIndex]??"";
   const data=ix.data instanceof Uint8Array?Buffer.from(ix.data):null;
   const result=classifyPumpAmmInstruction(program,data);
   if(!result.candidate)continue;
   const indices=ix.accountKeyIndexes??ix.accounts??[];
   const poolMatched=indices.some(i=>typeof i==="number"?keys[i]===poolAddress:asKey(i)===poolAddress);
   candidateOperations.push({operation:result.candidate,poolMatched,source,verified:false});
  }
 }
 return {status:"candidate_only",candidateOperations,withdrawalConfirmed:false,tokenBalanceCorroborated:false,loadedAddressCount:(tx.meta?.loadedAddresses?.writable?.length??0)+(tx.meta?.loadedAddresses?.readonly?.length??0)};
}

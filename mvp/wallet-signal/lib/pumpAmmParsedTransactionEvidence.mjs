import {classifyPumpAmmInstruction} from "./pumpAmmInstructionEvidence.mjs";
import {decodeInstructionBytes} from "./liquidityInstructionBytes.mjs";
const AUXILIARY_PUMP_DISCRIMINATORS={
 "0830be07b644b7e5":"sweep_protocol_fee",
 "20f6bf3408c949ba":"sweep_creator_fee",
 "e445a52e51cb9a1d":"anchor_event_cpi_marker"
};
const asKey=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k);
export function inspectPumpAmmParsedTransaction(tx,poolAddress) {
 if(!tx)return {status:"unavailable",candidateOperations:[],withdrawalConfirmed:false};
 if(tx.meta?.err)return {status:"failed_transaction",candidateOperations:[],withdrawalConfirmed:false};
 const message=tx.transaction?.message;
 const keys=[...(message?.staticAccountKeys??message?.accountKeys??[]),...(tx.meta?.loadedAddresses?.writable??[]),...(tx.meta?.loadedAddresses?.readonly??[])].map(asKey);
 const outer=message?.compiledInstructions??message?.instructions??[];
 const inner=(tx.meta?.innerInstructions??[]).flatMap(group=>group.instructions??[]);
 const candidateOperations=[];
 const instructionDiagnostics=[];
 for(const [source,instructions] of [["outer",outer],["inner",inner]]){
  for(const ix of instructions){
   const program=ix.programId?.toBase58?.()??keys[ix.programIdIndex]??"";
   const data=decodeInstructionBytes(ix.data);
   const isPumpAmm=program==="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
   const discriminatorHex=isPumpAmm&&data?.length>=8?data.subarray(0,8).toString("hex"):null;
   const auxiliaryOperation=discriminatorHex?AUXILIARY_PUMP_DISCRIMINATORS[discriminatorHex]??null:null;
   instructionDiagnostics.push({source,programId:program,dataType:ix.data instanceof Uint8Array?"bytes":typeof ix.data,dataLength:ix.data?.length??null,...(isPumpAmm?{discriminatorHex,decodedLength:data?.length??null,auxiliaryOperation}: {})});
   const result=classifyPumpAmmInstruction(program,data);
   if(!result.candidate)continue;
   const indices=ix.accountKeyIndexes??ix.accounts??[];
   const poolMatched=indices.some(i=>typeof i==="number"?keys[i]===poolAddress:asKey(i)===poolAddress);
   candidateOperations.push({operation:result.candidate,poolMatched,source,verified:false});
  }
 }
 return {status:"candidate_only",candidateOperations,withdrawalConfirmed:false,tokenBalanceCorroborated:false,loadedAddressCount:(tx.meta?.loadedAddresses?.writable?.length??0)+(tx.meta?.loadedAddresses?.readonly?.length??0),instructionDiagnostics:instructionDiagnostics.slice(0,40),instructionCount:instructionDiagnostics.length};
}

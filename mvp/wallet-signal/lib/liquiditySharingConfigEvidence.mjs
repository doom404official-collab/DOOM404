import {decodeInstructionBytes} from "./liquidityInstructionBytes.mjs";
const PUMP="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const MIGRATE="d0089f044aaf103a";
const key=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k);
export function inspectSharingConfigReferences(tx,targetPool){
 const message=tx?.transaction?.message;
 const keys=[...(message?.staticAccountKeys??message?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(key);
 const references=[];
 for(const [index,ix] of (message?.compiledInstructions??message?.instructions??[]).entries()){
  const program=ix.programId?.toBase58?.()??keys[ix.programIdIndex];
  if(program!==PUMP||decodeInstructionBytes(ix.data)?.subarray(0,8).toString("hex")!==MIGRATE)continue;
  const accounts=(ix.accountKeyIndexes??ix.accounts??[]).map(i=>typeof i==="number"?keys[i]:key(i));
  references.push({outerInstructionIndex:index,pool:accounts[0]??null,sharingConfig:accounts[1]??null,poolMatched:accounts[0]===targetPool,recipientAuthorized:false});
 }
 return {references,sharingConfigVerified:false,historyComplete:false};
}

import {decodeInstructionBytes} from "./liquidityInstructionBytes.mjs";
const PUMP="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const UPDATE=new Map([["d295802dbc3a4eaf","set_coin_creator"],["d0089f044aaf103a","migrate_pool_coin_creator"]]);
const key=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k);
export function inspectCreatorUpdateInstructions(tx,pool){
 const m=tx?.transaction?.message;
 const keys=[...(m?.staticAccountKeys??m?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(key);
 const updates=[];
 for(const [index,ix] of (m?.compiledInstructions??m?.instructions??[]).entries()){
  const program=ix.programId?.toBase58?.()??keys[ix.programIdIndex];
  if(program!==PUMP)continue;
  const bytes=decodeInstructionBytes(ix.data);
  const operation=UPDATE.get(bytes?.subarray(0,8).toString("hex"));
  if(!operation)continue;
  const accounts=(ix.accountKeyIndexes??ix.accounts??[]).map(i=>typeof i==="number"?keys[i]:key(i));
  updates.push({operation,outerInstructionIndex:index,pool:accounts[0]??null,poolMatched:accounts[0]===pool,creatorChangeVerified:false});
 }
 return {updates,creatorChangeVerified:false,historyComplete:false};
}

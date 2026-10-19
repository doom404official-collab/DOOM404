const PUMP_AMM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const SWEEPS=new Map([["0830be07b644b7e5","sweep_protocol_fee"],["20f6bf3408c949ba","sweep_creator_fee"]]);
const key=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k);
export function extractFeeSweepAccounts(tx,poolAddress){
 const m=tx?.transaction?.message;
 const keys=[...(m?.staticAccountKeys??m?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(key);
 const instructions=m?.compiledInstructions??m?.instructions??[];
 const records=[];
 for(const ix of instructions){
  const program=ix.programId?.toBase58?.()??keys[ix.programIdIndex];
  if(program!==PUMP_AMM)continue;
  // Decoding is handled by the shared bounded decoder.
  const data=ix.data;
  records.push({program,accountIndexes:ix.accountKeyIndexes??ix.accounts??[],data});
 }
 return {poolAddress,records,accountKeys:keys,settlementVerified:false};
}

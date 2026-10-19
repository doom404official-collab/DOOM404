import {decodeInstructionBytes} from "./liquidityInstructionBytes.mjs";
const PUMP_AMM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
const SWEEPS=new Map([["0830be07b644b7e5","sweep_protocol_fee"],["20f6bf3408c949ba","sweep_creator_fee"]]);
const key=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k);
export function extractFeeSweepAccounts(tx,poolAddress){
 const m=tx?.transaction?.message;
 const keys=[...(m?.staticAccountKeys??m?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(key);
 const instructions=m?.compiledInstructions??m?.instructions??[];
 const sweeps=[];
 for(const [outerInstructionIndex,ix] of instructions.entries()){
  const program=ix.programId?.toBase58?.()??keys[ix.programIdIndex];
  if(program!==PUMP_AMM)continue;
  const data=decodeInstructionBytes(ix.data);
  const operation=SWEEPS.get(data?.subarray(0,8).toString("hex"));
  if(!operation)continue;
  const indexes=ix.accountKeyIndexes??ix.accounts??[];
  const accounts=indexes.map(i=>typeof i==="number"?keys[i]:key(i));
  sweeps.push({operation,outerInstructionIndex,pool:accounts[2]??null,poolMatched:accounts[2]===poolAddress,quoteMint:accounts[3]??null,quoteTokenProgram:accounts[4]??null,quoteVault:accounts[5]??null,recipient:accounts[6]??null,recipientTokenAccount:accounts[7]??null,accountLayoutComplete:accounts.length>=12,settlementVerified:false});
 }
 return {sweeps,settlementVerified:false};
}

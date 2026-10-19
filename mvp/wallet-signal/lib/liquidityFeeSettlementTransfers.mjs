import {decodeInstructionBytes} from "./liquidityInstructionBytes.mjs";
const TOKEN_PROGRAMS=new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
const key=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??String(k);
const uint64=data=>{let n=0n;for(let i=8;i>=1;i--)n=(n<<8n)+BigInt(data[i]);return n.toString();};
export function inspectFeeSettlementTransfers(tx,sweepEvidence){
 const message=tx?.transaction?.message;
 const keys=[...(message?.staticAccountKeys??message?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(key);
 const sweeps=(sweepEvidence?.sweeps??[]).filter(s=>s.poolMatched&&s.accountLayoutComplete);
 const transfers=[];
 for(const group of tx?.meta?.innerInstructions??[]){
  for(const ix of group.instructions??[]){
   const program=ix.programId?.toBase58?.()??keys[ix.programIdIndex];
   if(!TOKEN_PROGRAMS.has(program))continue;
   const data=decodeInstructionBytes(ix.data);
   if(!data||data.length<9||![3,12].includes(data[0]))continue;
   const indexes=ix.accountKeyIndexes??ix.accounts??[];
   const accounts=indexes.map(i=>typeof i==="number"?keys[i]:key(i));
   if(data[0]===12&&data.length<10)continue;
   const source=accounts[0],destination=data[0]===3?accounts[1]:accounts[2];
   const matched=sweeps.find(s=>s.quoteVault===source&&s.recipientTokenAccount===destination);
   if(!matched)continue;
   transfers.push({operation:matched.operation,source,destination,amountRaw:uint64(data),tokenInstruction:data[0]===3?"transfer":"transfer_checked",outerInstructionIndex:group.index,recipient:matched.recipient});
  }
 }
 return {transfers,matchedTransferCount:transfers.length,settlementVerified:false,authorizationVerified:false};
}

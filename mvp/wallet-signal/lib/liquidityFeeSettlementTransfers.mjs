import {extractFeeSweepAccounts} from './liquidityFeeSweepAccounts.mjs';
import {inspectHistoricalTransactionProof} from './liquidityHistoricalDecoder.mjs';
import {decodeInstructionBytes} from "./liquidityInstructionBytes.mjs";
const TOKEN_PROGRAMS=new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
const key=k=>typeof k==="string"?k:k?.pubkey?.toBase58?.()??k?.toBase58?.()??(typeof k?.pubkey==='string'?k.pubkey:null);
const uint64=data=>{let n=0n;for(let i=8;i>=1;i--)n=(n<<8n)+BigInt(data[i]);return n.toString();};
export function inspectFeeSettlementTransfers(tx,sweepEvidence,{signature,slot}={}){
 const unavailable=reason=>({transfers:[],matchedTransferCount:0,evidenceComplete:false,reason,settlementVerified:false,authorizationVerified:false});
 const proof=inspectHistoricalTransactionProof(tx,signature,slot);
 if(!proof.valid||proof.execution!=='EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED')return unavailable(proof.reason||'TRANSACTION_FAILED');
 const outer=tx?.transaction?.message?.compiledInstructions??tx?.transaction?.message?.instructions;
 const inner=tx?.meta?.innerInstructions;
 if(!Array.isArray(outer)||!Array.isArray(inner))return unavailable('INSTRUCTION_EVIDENCE_UNAVAILABLE');
 const indexes=new Set();
 for(const group of inner){if(!group||!Number.isSafeInteger(group.index)||group.index<0||group.index>=outer.length||indexes.has(group.index)||!Array.isArray(group.instructions))return unavailable('INSTRUCTION_IDENTITY_CONFLICT');indexes.add(group.index);}

 const message=tx?.transaction?.message;
 const keys=[...(message?.staticAccountKeys??message?.accountKeys??[]),...(tx?.meta?.loadedAddresses?.writable??[]),...(tx?.meta?.loadedAddresses?.readonly??[])].map(key);
 const sweeps=(sweepEvidence?.sweeps??[]).filter(s=>s?.poolMatched===true&&s.accountLayoutComplete===true);
 if(new Set(sweeps.map(s=>s.outerInstructionIndex)).size!==sweeps.length||sweeps.some(s=>s.innerInstructionIndex!=null))return unavailable('SWEEP_IDENTITY_CONFLICT');
 for(const sweep of sweeps){
  if(typeof sweep.pool!=='string'||!sweep.pool)return unavailable('SWEEP_PARENT_UNVERIFIED');
  const actual=extractFeeSweepAccounts(tx,sweep.pool).sweeps.filter(s=>s.outerInstructionIndex===sweep.outerInstructionIndex);
  if(actual.length!==1||actual[0].poolMatched!==true||actual[0].accountLayoutComplete!==true||['operation','pool','quoteMint','quoteTokenProgram','quoteVault','recipient','recipientTokenAccount'].some(k=>actual[0][k]!==sweep[k]))return unavailable('SWEEP_PARENT_UNVERIFIED');
 }
 const transfers=[];
 for(const group of tx?.meta?.innerInstructions??[]){
  for(const [innerInstructionIndex,ix] of group.instructions.entries()){
   if(!ix||typeof ix!=='object')return unavailable('INSTRUCTION_EVIDENCE_UNAVAILABLE');
   const program=ix.programId!==undefined?key(ix.programId):keys[ix.programIdIndex];
   if(typeof program!=='string'||!program)return unavailable('INSTRUCTION_EVIDENCE_UNAVAILABLE');
   if(!TOKEN_PROGRAMS.has(program))continue;
   const data=decodeInstructionBytes(ix.data);
   if(!data||![3,12].includes(data[0]))continue;
   if(data.length!==(data[0]===3?9:10))return unavailable('INVALID_TRANSFER_LAYOUT');
   const indexes=ix.accountKeyIndexes??ix.accounts??[];
   if(!Array.isArray(indexes)||indexes.length<(data[0]===3?3:4))return unavailable('INVALID_TRANSFER_ACCOUNTS');
   const accounts=indexes.map(i=>typeof i==="number"?keys[i]:key(i));
   if(accounts.some(a=>typeof a!=='string'||!a))return unavailable('INVALID_TRANSFER_ACCOUNTS');
   const source=accounts[0],destination=data[0]===3?accounts[1]:accounts[2];
   const matched=sweeps.find(s=>s.quoteVault===source&&s.recipientTokenAccount===destination&&s.outerInstructionIndex===group.index);
   if(!matched)continue;
   if(!['sweep_creator_fee','sweep_protocol_fee'].includes(matched.operation)||typeof matched.quoteMint!=='string'||!matched.quoteMint||matched.quoteTokenProgram!==program||(data[0]===12&&accounts[1]!==matched.quoteMint))return unavailable('TRANSFER_MINT_PROGRAM_MISMATCH');
   transfers.push({operation:matched.operation,source,destination,amountRaw:uint64(data),tokenInstruction:data[0]===3?"transfer":"transfer_checked",outerInstructionIndex:group.index,innerInstructionIndex,signature,slot:tx.slot,mint:matched.quoteMint,tokenProgram:program,authority:accounts[data[0]===3?2:3],parentInstructionMatched:true,recipient:matched.recipient});
  }
 }
 return {transfers,signature,slot:tx.slot,evidenceComplete:true,matchedTransferCount:transfers.length,settlementVerified:false,authorizationVerified:false};
}

import {decodePumpFunCreate,PUMP_PROGRAM_ID} from './pumpFunCreation.mjs';
const address=x=>typeof x==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
const key=x=>typeof x==='string'?x:x?.pubkey;
/** Inspect already available transaction bytes/parsed envelope only.
 * Retained Pump create decoders prove role layout candidates, not an allocation
 * instruction or historically applicable distribution schema. Never promote them.
 */
export function inspectCreatorLaunchDistributionTransaction({mint,creator,signature,transaction:tx}={}){
 const result=reason=>({version:1,status:'UNKNOWN',reason,verifiedLaunchDistributions:[],
  launchDistributionCoverageComplete:false,initialAttributableRaw:null,zeroAllocationVerified:false,
  instructionCandidates:[]});
 if(!address(mint)||!address(creator)||typeof signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature))return result('INPUT_IDENTITY_UNVERIFIED');
 if(!tx)return result('RAW_TRANSACTION_UNAVAILABLE');
 if(!Number.isSafeInteger(tx.slot)||tx.slot<0||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0||
  !Array.isArray(tx.transaction?.signatures)||tx.transaction.signatures[0]!==signature)return result('TRANSACTION_IDENTITY_UNVERIFIED');
 if(tx.version!==undefined&&!['legacy',0].includes(tx.version))return result('TRANSACTION_VERSION_UNSUPPORTED');
 if(!tx.meta||typeof tx.meta!=='object'||Array.isArray(tx.meta)||!Object.hasOwn(tx.meta,'err'))return result('TRANSACTION_STATUS_UNVERIFIED');
 if(tx.meta.err!==null)return result('TRANSACTION_NOT_SUCCESSFUL');
 const message=tx.transaction.message;
 if(!Array.isArray(message?.accountKeys)||!message.accountKeys.every(x=>address(key(x)))||
  !Array.isArray(message.instructions)||!Array.isArray(tx.meta.innerInstructions))return result('INSTRUCTION_CONTEXT_UNVERIFIED');
 const keys=message.accountKeys.map(key),instructions=[],seen=new Set();
 const add=(ix,instructionIndex,innerInstructionIndex)=>{
  if(!ix||typeof ix!=='object'||Array.isArray(ix))return false;
  const programId=ix.programId??(Number.isSafeInteger(ix.programIdIndex)&&ix.programIdIndex>=0?keys[ix.programIdIndex]:null);
  if(ix.programId!==undefined&&ix.programIdIndex!==undefined&&keys[ix.programIdIndex]!==ix.programId)return false;
  if(!address(programId))return false;
  instructions.push({ix,programId,instructionIndex,innerInstructionIndex});return true;
 };
 for(let i=0;i<message.instructions.length;i++)if(!add(message.instructions[i],i,null))return result('INSTRUCTION_CONTEXT_UNVERIFIED');
 for(const group of tx.meta.innerInstructions){
  if(!group||!Number.isSafeInteger(group.index)||group.index<0||group.index>=message.instructions.length||seen.has(group.index)||!Array.isArray(group.instructions))return result('INSTRUCTION_CONTEXT_UNVERIFIED');
  seen.add(group.index);
  for(let i=0;i<group.instructions.length;i++)if(!add(group.instructions[i],group.index,i))return result('INSTRUCTION_CONTEXT_UNVERIFIED');
 }
 const candidates=[];let pumpObserved=false,roleMismatch=false;
 for(const {ix,programId,instructionIndex,innerInstructionIndex} of instructions){
  if(programId!==PUMP_PROGRAM_ID)continue;
  pumpObserved=true;
  if(!Array.isArray(ix.accounts)||!ix.accounts.every(account=>address(Number.isSafeInteger(account)&&account>=0?keys[account]:key(account))))continue;
  let decoded;try{decoded=decodePumpFunCreate({instruction:ix,transaction:tx,mint,programId});}catch{continue;}
  if(!decoded)continue;
  if(decoded.creator!==creator){roleMismatch=true;continue;}
  candidates.push({signature,instructionIndex,innerInstructionIndex,programId,decoderVersion:decoded.decoderVersion});
 }
 if(roleMismatch)return result('CREATOR_ROLE_MISMATCH');
 if(!candidates.length)return result(pumpObserved?'LAUNCH_LAYOUT_UNVERIFIED':'SUPPORTED_LAUNCH_INSTRUCTION_NOT_FOUND');
 return {...result('HISTORICAL_DISTRIBUTION_SCHEMA_UNVERIFIED'),instructionCandidates:candidates};
}

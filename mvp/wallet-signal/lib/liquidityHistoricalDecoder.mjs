import {isRecognizedHolderTransactionError as isRecognizedTransactionError} from './holderTransactionError.mjs';
import {createHash} from "node:crypto";
export const HISTORY_CLASSIFICATION="AMOUNT_RECONCILED_AUTHORIZATION_PENDING";
export const PUMP_AMM_PROGRAM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const HISTORICAL_NAMES=["set_coin_creator","migrate_pool_coin_creator","admin_set_coin_creator","admin_cto_pool","collect_coin_creator_fee","transfer_creator_fees_to_pump","transfer_creator_fees_to_pump_v2"];
export function anchorDiscriminator(name){return createHash("sha256").update("global:"+name).digest().subarray(0,8).toString("hex");}
const candidates=new Map(HISTORICAL_NAMES.map(n=>[anchorDiscriminator(n),n]));
export function decodeHistoricalCandidate(instruction,signature,slot,provider){
 if(instruction?.programId!==PUMP_AMM_PROGRAM)return null;
 // Only the first eight bytes identify a candidate; the remaining accounts and authorization are NOT validated.
 let name=null,coverage=null;
 if(typeof instruction?.parsed?.type==="string"&&HISTORICAL_NAMES.includes(instruction.parsed.type)){
   name=instruction.parsed.type;coverage="parsed_instruction_only";
 }else if(typeof instruction?.data==="string"){
   // Solana JSON parsed responses encode unknown program instruction data as base58.
   const bytes=decodeBase58(instruction.data);
   if(bytes.length>=8){name=candidates.get(Buffer.from(bytes.subarray(0,8)).toString("hex"))||null;coverage="anchor_discriminator_only";}
 }
 if(!name)return null;
 // A recognized discriminator does not prove that the instruction executed successfully.
 return {signature,slot,provider,operation:name,programId:instruction.programId,rawInstruction:instruction,authorizationVerified:false,classification:"UNVERIFIED_CANDIDATE",decoderCoverage:coverage,accountRolesVerified:false,signerAuthorizationVerified:false,feeSettlementNotLpWithdrawal:name.includes("creator_fee")||name.startsWith("transfer_creator_fees")};
}
function decodeBase58(input){
 const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
 let num=0n;
 for(const char of input){const i=alphabet.indexOf(char);if(i<0)return new Uint8Array();num=num*58n+BigInt(i);}
 const values=[];
 while(num>0n){values.unshift(Number(num&255n));num>>=8n;}
 for(const char of input){if(char!=="1")break;values.unshift(0);}
 return Uint8Array.from(values);
}
export function inspectHistoricalSignerEvidence(tx,event){
 const keys=tx?.transaction?.message?.accountKeys;
 if(!Array.isArray(keys)||!event)return {status:"SIGNER_EVIDENCE_UNAVAILABLE",signers:[],accountRolesVerified:false,signerAuthorizationVerified:false};
 const signers=keys.filter(k=>typeof k==="object"&&k.signer===true).map(k=>k.pubkey).filter(k=>typeof k==="string");
 const referenced=(event.rawInstruction?.accounts||[]).map(a=>typeof a==="string"?a:a?.pubkey).filter(Boolean);
 const signerReferencedAccounts=referenced.filter(a=>signers.includes(a));
 return {status:referenced.length?"SIGNERS_OBSERVED_ROLES_UNVERIFIED":"INSTRUCTION_ACCOUNTS_UNAVAILABLE",signers,referencedAccounts:referenced,signerReferencedAccounts,accountRolesVerified:false,signerAuthorizationVerified:false};
}
export function historicalRoleAssessment(event,tx,expectedPool){
 const accounts=event?.rawInstruction?.accounts;
 const referenced=Array.isArray(accounts)?accounts.map(a=>typeof a==="string"?a:a?.pubkey).filter(Boolean):[];
 const poolReferenced=typeof expectedPool==="string"&&referenced.includes(expectedPool);
 const signerEvidence=inspectHistoricalSignerEvidence(tx,event);
 return {status:"ACCOUNT_LAYOUT_NOT_INDEPENDENTLY_VERIFIED",poolReferenced,signerReferencedAccounts:signerEvidence.signerReferencedAccounts||[],accountRolesVerified:false,signerAuthorizationVerified:false,authorizationVerified:false};
}
export function classifyHistoricalTransaction(tx){
 if(!tx?.meta||typeof tx.meta!=="object"||Array.isArray(tx.meta)||!Object.hasOwn(tx.meta,'err'))return "TRANSACTION_META_UNAVAILABLE";
 if(tx.meta.err!==null){
  return isRecognizedTransactionError(tx.meta.err)?"FAILED_TRANSACTION":"TRANSACTION_META_UNAVAILABLE";
 }
 return "EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED";
}
export function validateHistoryCheckpoint(prior,pool){
 if(!prior||prior.schemaVersion!==1||prior.pool!==pool||prior.classification!==HISTORY_CLASSIFICATION||!Array.isArray(prior.seen)||!Array.isArray(prior.events)||!Array.isArray(prior.pendingSignatures||[]))throw Error("INVALID_HISTORY_CHECKPOINT");
 if(prior.complete&&((prior.pendingSignatures||[]).length>0))throw Error("INVALID_COMPLETE_HISTORY_CHECKPOINT");
 if(prior.before!==null&&prior.before!==undefined&&typeof prior.before!=="string")throw Error("INVALID_HISTORY_CURSOR");
 if(new Set(prior.seen).size!==prior.seen.length)throw Error("DUPLICATE_HISTORY_SIGNATURES");
 if((prior.pendingSignatures||[]).some(sig=>prior.seen.includes(sig)))throw Error("PENDING_SIGNATURE_ALREADY_SEEN");
 if(prior.events.some(e=>e.authorizationVerified===true||e.classification!=="UNVERIFIED_CANDIDATE"))throw Error("UNSAFE_HISTORY_EVENT_PROMOTION");
 return prior;
}

/** Identity/execution proof only; no authority or archive-completeness inference. */
export function inspectHistoricalTransactionProof(tx,signature,slot){
 const unavailable=reason=>({valid:false,reason,execution:'TRANSACTION_META_UNAVAILABLE'});
 if(typeof signature!=='string'||!signature||!Number.isSafeInteger(tx?.slot)||tx.slot<0||(slot!==undefined&&tx.slot!==slot))return unavailable('TRANSACTION_SLOT_MISMATCH');
 const signatures=tx?.transaction?.signatures;
 if(!Array.isArray(signatures)||signatures[0]!==signature||signatures.some(s=>typeof s!=='string'||!s)||new Set(signatures).size!==signatures.length)return unavailable('TRANSACTION_SIGNATURE_MISMATCH');
 if(tx.version!==undefined&&tx.version!=='legacy'&&tx.version!==0)return unavailable('TRANSACTION_VERSION_UNSUPPORTED');
 const execution=classifyHistoricalTransaction(tx);
 if(execution==='TRANSACTION_META_UNAVAILABLE')return unavailable('TRANSACTION_EXECUTION_UNAVAILABLE');
 return {valid:true,execution,signature,slot:tx.slot};
}
/** New observations get instruction positions. Legacy retained events are untouched. */
export function extractHistoricalTransactionCandidates(tx,signature,slot,provider,pool){
 const proof=inspectHistoricalTransactionProof(tx,signature,slot);
 if(!proof.valid)throw Error(proof.reason);
 if(proof.execution==='FAILED_TRANSACTION')return []; // rolled-back instructions did not settle
 const outer=tx?.transaction?.message?.instructions,inner=tx.meta.innerInstructions;
 if(!Array.isArray(outer)||!Array.isArray(inner))throw Error('TRANSACTION_INSTRUCTIONS_UNAVAILABLE');
 const groups=new Map();
 for(const group of inner){
  if(!group||!Number.isSafeInteger(group.index)||group.index<0||group.index>=outer.length||groups.has(group.index)||!Array.isArray(group.instructions))throw Error('TRANSACTION_INSTRUCTION_IDENTITY_CONFLICT');
  groups.set(group.index,group.instructions);
 }
 const events=[];
 for(let outerInstructionIndex=0;outerInstructionIndex<outer.length;outerInstructionIndex++){
  const entries=[{instruction:outer[outerInstructionIndex],innerInstructionIndex:null},...(groups.get(outerInstructionIndex)||[]).map((instruction,innerInstructionIndex)=>({instruction,innerInstructionIndex}))];
  for(const {instruction,innerInstructionIndex} of entries){
   if(!instruction||typeof instruction!=='object'||Array.isArray(instruction)||typeof instruction.programId!=='string'||!instruction.programId||(instruction.accounts!==undefined&&!Array.isArray(instruction.accounts)))throw Error('TRANSACTION_INSTRUCTIONS_UNAVAILABLE');
   const event=decodeHistoricalCandidate(instruction,signature,slot,provider);
   if(event&&instruction.parsed&&instruction.data!==undefined){
    const raw=decodeHistoricalCandidate({...instruction,parsed:undefined},signature,slot,provider);
    if(!raw||raw.operation!==event.operation)throw Error('TRANSACTION_INSTRUCTION_IDENTITY_CONFLICT');
   }
   if(event)events.push({...structuredClone(event),outerInstructionIndex,innerInstructionIndex,instructionIdentity:signature+':'+outerInstructionIndex+':'+(innerInstructionIndex===null?'outer':innerInstructionIndex),transactionExecution:proof.execution,signerEvidence:inspectHistoricalSignerEvidence(tx,event),roleAssessment:historicalRoleAssessment(event,tx,pool),eligibleForAuthorizationReview:true});
  }
 }
 return events;
}

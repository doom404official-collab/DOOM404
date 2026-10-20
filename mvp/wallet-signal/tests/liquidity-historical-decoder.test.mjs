import test from "node:test";
import assert from "node:assert/strict";
import {anchorDiscriminator,decodeHistoricalCandidate,validateHistoryCheckpoint,classifyHistoricalTransaction,inspectHistoricalSignerEvidence,historicalRoleAssessment,PUMP_AMM_PROGRAM,HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
function base58(bytes){const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let out="";while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}for(const b of bytes){if(b!==0)break;out="1"+out;}return out||"1";}
test("rejects instructions from unrelated programs",()=>{assert.equal(decodeHistoricalCandidate({programId:"other",parsed:{type:"set_coin_creator"}},"sig",1,"helius"),null)});
test("recognizes Anchor discriminator without promoting authorization",()=>{
 const bytes=Buffer.from(anchorDiscriminator("set_coin_creator")+"00","hex");
 const candidate=decodeHistoricalCandidate({programId:PUMP_AMM_PROGRAM,data:base58(bytes)},"sig",123,"helius");
 assert.equal(candidate.operation,"set_coin_creator");
 assert.equal(candidate.decoderCoverage,"anchor_discriminator_only");
 assert.equal(candidate.authorizationVerified,false);
 assert.equal(candidate.classification,"UNVERIFIED_CANDIDATE");
});
test("unknown discriminator is not an event",()=>assert.equal(decodeHistoricalCandidate({programId:PUMP_AMM_PROGRAM,data:base58(Buffer.alloc(9,255))},"sig",1,"helius"),null));
test("rejects foreign or prematurely completed checkpoints",()=>{
 const state={schemaVersion:1,pool:"pool",seen:[],events:[],pendingSignatures:[],classification:HISTORY_CLASSIFICATION,complete:false};
 assert.equal(validateHistoryCheckpoint(state,"pool"),state);
 assert.throws(()=>validateHistoryCheckpoint({...state,pool:"other"},"pool"));
 assert.throws(()=>validateHistoryCheckpoint({...state,complete:true,pendingSignatures:["sig"]},"pool"));
});

test("failed transactions cannot establish executed authorization",()=>{
 assert.equal(classifyHistoricalTransaction({meta:{err:{InstructionError:[0,"Custom"]}}}),"FAILED_TRANSACTION");
 assert.equal(classifyHistoricalTransaction({meta:{err:null}}),"EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED");
 assert.equal(classifyHistoricalTransaction({}),"TRANSACTION_META_UNAVAILABLE");
});

test("creator fee collection remains an unverified fee candidate, never an LP withdrawal",()=>{
 const data=base58(Buffer.from(anchorDiscriminator("collect_coin_creator_fee"),"hex"));
 const event=decodeHistoricalCandidate({programId:PUMP_AMM_PROGRAM,data},"sig",458811200,"helius");
 assert.equal(event.operation,"collect_coin_creator_fee");
 assert.equal(event.authorizationVerified,false);
 assert.equal(event.accountRolesVerified,false);
 assert.equal(event.signerAuthorizationVerified,false);
 assert.equal(event.classification,"UNVERIFIED_CANDIDATE");
 assert.equal(event.feeSettlementNotLpWithdrawal,true);
});

test("signer observations do not establish account roles or creator authorization",()=>{
 const event={rawInstruction:{accounts:["pool","creator"]}};
 const tx={transaction:{message:{accountKeys:[{pubkey:"creator",signer:true},{pubkey:"pool",signer:false}]}}};
 const evidence=inspectHistoricalSignerEvidence(tx,event);
 assert.deepEqual(evidence.signers,["creator"]);
 assert.deepEqual(evidence.signerReferencedAccounts,["creator"]);
 assert.equal(evidence.status,"SIGNERS_OBSERVED_ROLES_UNVERIFIED");
 assert.equal(evidence.accountRolesVerified,false);
 assert.equal(evidence.signerAuthorizationVerified,false);
});

test("unrelated transaction signer is not evidence of creator instruction authority",()=>{
 const tx={transaction:{message:{accountKeys:[{pubkey:"feePayer",signer:true},{pubkey:"creator",signer:false}]}}};
 const evidence=inspectHistoricalSignerEvidence(tx,{rawInstruction:{accounts:["creator","pool"]}});
 assert.deepEqual(evidence.signerReferencedAccounts,[]);
 assert.equal(evidence.signerAuthorizationVerified,false);
});

test("pool account presence alone cannot establish creator authorization",()=>{
 const event={rawInstruction:{accounts:["pool","creator"]}};
 const tx={transaction:{message:{accountKeys:[{pubkey:"creator",signer:true}]}}};
 const result=historicalRoleAssessment(event,tx,"pool");
 assert.equal(result.poolReferenced,true);
 assert.equal(result.accountRolesVerified,false);
 assert.equal(result.signerAuthorizationVerified,false);
 assert.equal(result.authorizationVerified,false);
});

test("failed execution cannot be promoted to historical authorization evidence",()=>{
 const failed={meta:{err:{InstructionError:[0,"Custom"]}}};
 assert.notEqual(classifyHistoricalTransaction(failed),"EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED");
 const success={meta:{err:null}};
 assert.equal(classifyHistoricalTransaction(success),"EXECUTION_SUCCEEDED_AUTHORIZATION_UNVERIFIED");
});

test("checkpoint restoration rejects unsafe authorization promotion and duplicate signatures",()=>{
 const state={schemaVersion:1,pool:"pool",before:"cursor",seen:["a"],pendingSignatures:[],events:[],classification:HISTORY_CLASSIFICATION,complete:false};
 assert.equal(validateHistoryCheckpoint(state,"pool"),state);
 assert.throws(()=>validateHistoryCheckpoint({...state,seen:["a","a"]},"pool"),/DUPLICATE/);
 assert.throws(()=>validateHistoryCheckpoint({...state,pendingSignatures:["a"]},"pool"),/PENDING/);
 assert.throws(()=>validateHistoryCheckpoint({...state,events:[{classification:"VERIFIED",authorizationVerified:true}]},"pool"),/UNSAFE/);
});

test("checkpoint rejects events already promoted to verified authorization",()=>{
 const state={schemaVersion:1,pool:"pool",before:null,seen:["sig"],pendingSignatures:[],events:[{signature:"sig",classification:"UNVERIFIED_CANDIDATE",authorizationVerified:false}],classification:HISTORY_CLASSIFICATION,complete:false};
 assert.equal(validateHistoryCheckpoint(state,"pool"),state);
 assert.throws(()=>validateHistoryCheckpoint({...state,events:[{...state.events[0],authorizationVerified:true}]},"pool"),/UNSAFE/);
});

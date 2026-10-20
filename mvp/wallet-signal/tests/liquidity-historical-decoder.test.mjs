import test from "node:test";
import assert from "node:assert/strict";
import {anchorDiscriminator,decodeHistoricalCandidate,validateHistoryCheckpoint,classifyHistoricalTransaction,PUMP_AMM_PROGRAM,HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
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

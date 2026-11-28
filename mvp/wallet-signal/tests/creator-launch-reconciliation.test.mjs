import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {reconcileCreatorLaunchTransaction} from '../lib/creatorLaunchTransactionReconciliation.mjs';
import {summarizeCreatorAcquisitionLedger} from '../lib/creatorAcquisitionLedger.mjs';
const retained=JSON.parse(readFileSync(new URL('./fixtures/creator-launch-447328096.json',import.meta.url)));
const args=()=>({mint:'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator:'6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC',signature:retained.signature,transaction:structuredClone(retained.transaction)});
test('retained launch separates zero direct issuance from paid creator purchase and stays coverage-ineligible',()=>{const a=args(),r=reconcileCreatorLaunchTransaction(a);assert.equal(r.status,'VERIFIED_TRANSACTION_LOCAL_LAUNCH');assert.equal(r.initialAllocationEvidence.zeroAllocationVerified,true);assert.equal(r.event.type,'PURCHASE');assert.equal(r.event.amountRaw,'15664233491746');assert.equal(r.event.instructionIndex,5);assert.equal(r.event.innerInstructionIndex,2);assert.equal(r.settlement.curvePaymentLamports,'444444443');const ledger=summarizeCreatorAcquisitionLedger({...a,events:[r.event,r.event],historyComplete:false,attributionComplete:true});assert.equal(ledger.acceptedCount,1);assert.equal(ledger.purchasedRaw,'15664233491746');assert.equal(ledger.scoreEligible,false);assert.equal(r.settlement.historicalFeeAuthorizationVerified,false);});
for(const [name,mutate] of [
 ['wrong signature',a=>a.signature='1'.repeat(88)],
 ['wrong creator',a=>a.creator='GkEg3cEW2V1RmvuM2CuhJGJmgBRbyyC5dNvBt5KGuxPy'],
 ['unsuccessful transaction',a=>a.transaction.meta.err={InstructionError:[5,'Custom']}],
 ['receipt owner mismatch',a=>a.transaction.meta.postTokenBalances[1].owner='GkEg3cEW2V1RmvuM2CuhJGJmgBRbyyC5dNvBt5KGuxPy'],
 ['unreconciled SOL',a=>a.transaction.meta.postBalances[0]--],
 ['unreconciled token receipt',a=>a.transaction.meta.postTokenBalances[1].uiTokenAmount.amount='15664233491745'],
 ['mint issuance conflict',a=>a.transaction.meta.innerInstructions.find(g=>g.index===2).instructions.find(i=>i.parsed?.type==='mintTo').parsed.info.amount='999999999999999'],
 ['extra token transfer',a=>{const g=a.transaction.meta.innerInstructions.find(g=>g.index===5);g.instructions.push(structuredClone(g.instructions[2]));}],
 ['opaque lifecycle instruction',a=>a.transaction.meta.innerInstructions.find(g=>g.index===5).instructions.push({programId:'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',data:'111'})],
 ['duplicate inner group',a=>a.transaction.meta.innerInstructions.push(structuredClone(a.transaction.meta.innerInstructions[0]))]
])test('rejects '+name,()=>{const a=args();mutate(a);const r=reconcileCreatorLaunchTransaction(a);assert.equal(r.status,'UNVERIFIED');assert.equal(r.event,null);assert.equal(r.initialAllocationEvidence,null);});

test('resume revalidates retained launch evidence without replaying exhausted history or duplicating purchase',async()=>{
 const {runCreatorIntelligenceTick}=await import('../lib/creatorIntelligenceTick.mjs');const a=args(),proof=reconcileCreatorLaunchTransaction(a);let requests=0,saves=0;
 let job={mint:a.mint,status:'partial',stage:'selling',lease_owner:null,state:{originEvidence:[{creator:a.creator,signature:a.signature,programId:'6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',decoderVersion:'pump-fun-create_v2-prefix-v1'}],originRecheck:{signature:a.signature,rechecked:true},launchTimestamp:a.transaction.blockTime,launchReconciliationTransaction:a.transaction,creatorHistoryRpcExhausted:true,creatorHistoryCursor:a.signature,creatorProcessedSignatures:[a.signature],creatorHistorySignatures:[a.signature],creatorPendingSignatures:[],creatorVerifiedAcquisitionEvents:[proof.event]}};
 const store={get:async()=>structuredClone(job),claim:async(mint,owner)=>{job.lease_owner=owner;return true;},save:async v=>{saves++;job.state=v.state;return true;}};
 const run=()=>runCreatorIntelligenceTick({mint:a.mint,store,rpcUrl:'https://rpc.invalid',fetchImpl:async()=>{requests++;throw Error('UNEXPECTED_PROVIDER_READ');},maxRequests:3});
 await run();await run();assert.equal(requests,0);assert.equal(saves,2);assert.equal(job.state.creatorVerifiedAcquisitionEvents.length,1);assert.equal(job.state.initialAllocationEvidence.zeroAllocationVerified,true);assert.equal(job.state.creatorAcquisitionLedger.purchasedRaw,'15664233491746');assert.equal(job.state.creatorHistoryComplete,false);assert.equal(job.state.selling.creatorSellingScoreEligible,false);
});

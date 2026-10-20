import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCreatorRetention,blockCreatorRetention} from '../lib/creatorRetentionIntegrity.mjs';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
import {assessCreatorInitialAllocation} from '../lib/creatorInitialAllocationEvidence.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature=i=>'2'.repeat(80)+[i%58,Math.floor(i/58)%58,Math.floor(i/3364)%58].map(n=>'123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[n]).join('');
const ids=n=>Array.from({length:n},(_,i)=>signature(i));
const tx={blockTime:1700000000,transaction:{message:{accountKeys:[],instructions:[]}},meta:{err:null,preTokenBalances:[],postTokenBalances:[]}};
function harness(initial,stage='selling',status='partial'){let state=initial;const methods=[];return {get state(){return state},methods,
 store:{async get(){return {stage,status,state}},async claim(){return true},async save(v){state=v.state}},
 fetchImpl:async(_,options)=>{const {method}=JSON.parse(options.body);methods.push(method);return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?tx:[]})}}};}
const tick=h=>runCreatorIntelligenceTick({mint,store:h.store,rpcUrl:'https://example.com',fetchImpl:h.fetchImpl,creatorBatchSize:1});
test('retention permits 5000 and rejects 5001 for all durable histories',()=>{
 for(const field of ['creatorVerifiedAcquisitionEvents','creatorAcquisitionMovements','creatorTransferDirections','creatorProcessedSignatures','creatorPendingSignatures']){
  assert.doesNotThrow(()=>assertCreatorRetention({[field]:ids(5000)}));
  assert.throws(()=>assertCreatorRetention({[field]:ids(5001)}),/CREATOR_RETENTION_BLOCKED/);
  assert.throws(()=>assertCreatorRetention({[field]:ids(5000)},{legacy:true}),/CREATOR_RETENTION_BLOCKED/);
 }
});
test('pending cap uses backpressure, preserving every unprocessed signature and cursor',async()=>{
 const h=harness({originEvidence:[{creator}],creatorRetentionVersion:1,creatorPendingSignatures:ids(5000),creatorHistoryCursor:'prior'});
 await tick(h);
 assert.deepEqual(h.methods,['getTransaction']);
 assert.equal(h.state.creatorHistoryCursor,'prior');
 assert.deepEqual(h.state.creatorPendingSignatures,ids(5000).slice(1));
 assert.deepEqual(h.state.creatorProcessedSignatures,[signature(0)]);
});
test('overflow atomically preserves checkpoint and cannot clear its gate on restart',async()=>{
 const initial={originEvidence:[{creator}],creatorRetentionVersion:1,creatorProcessedSignatures:ids(5000),creatorPendingSignatures:[signature(5001)],creatorHistoryCursor:'prior',creatorArchiveCoverageVerified:true,creatorAcquisitionAttributionComplete:true};
 const h=harness(initial);
 await tick(h);
 assert.equal(h.state.creatorRetentionBlocked.reason,'CHECKPOINT_CAPACITY_EXCEEDED');
 assert.equal(h.state.creatorHistoryCursor,'prior');
 assert.deepEqual(h.state.creatorProcessedSignatures,initial.creatorProcessedSignatures);
 assert.deepEqual(h.state.creatorPendingSignatures,[signature(5001)]);
 assert.equal(h.state.creatorHistoryComplete,false);
 assert.equal(h.state.creatorAcquisitionLedger.scoreEligible,false);
 const calls=h.methods.length;await tick(h);
 assert.equal(h.methods.length,calls);
 assert.equal(h.state.creatorRetentionBlocked.recoveryRequired,true);
});
test('legacy saturated evidence fails closed without fetching or claiming completeness',async()=>{
 const h=harness({originEvidence:[{creator}],creatorVerifiedAcquisitionEvents:ids(5000),creatorHistoryComplete:true});
 await tick(h);assert.equal(h.methods.length,0);assert.equal(h.state.creatorHistoryComplete,false);
 assert.equal(h.state.creatorRetentionBlocked.reason,'LEGACY_RETENTION_INTEGRITY_UNPROVEN');
});
test('blocked state removes stale window eligibility',()=>{
 const state=blockCreatorRetention({selling:{creatorSellingScoreEligible:true,windows:[{scoreEligible:true,historyComplete:true,sellThroughPct:10}]}},'test');
 assert.equal(state.selling.creatorSellingScoreEligible,false);assert.equal(state.selling.windows[0].scoreEligible,false);assert.equal(state.selling.windows[0].sellThroughPct,null);
});
test('initial allocation requires literal true coverage, not truthy values',()=>{
 for(const coverageComplete of [false,'false','true',1,{},null]){
 const result=assessCreatorInitialAllocation({mint,creator,launchTimestamp:10,coverageComplete});
 assert.equal(result.initialAttributableRaw,null);assert.equal(result.coverageComplete,false);assert.equal(result.status,'INITIAL_ALLOCATION_INCOMPLETE');}
 assert.equal(assessCreatorInitialAllocation({mint,creator,launchTimestamp:10,coverageComplete:true}).initialAttributableRaw,'0');
});

test('later and complete stages cannot bypass retention gates',async()=>{
 for(const status of ['partial','complete']){
 const h=harness({originEvidence:[{creator}],creatorVerifiedAcquisitionEvents:ids(5000),creatorHistoryComplete:true,selling:{creatorSellingScoreEligible:true}},'previous_launches',status);
 await tick(h);assert.equal(h.methods.length,0);assert.equal(h.state.creatorHistoryComplete,false);assert.equal(h.state.selling.creatorSellingScoreEligible,false);assert.equal(h.state.creatorRetentionBlocked.recoveryRequired,true);
 }
});

test('history-only resumed backlog is queued before rolling display buffer truncation',async()=>{
 const h=harness({originEvidence:[{creator}],creatorRetentionVersion:1,creatorHistorySignatures:ids(2000),creatorHistoryCursor:'prior'});
 const pages=Array.from({length:3},(_,page)=>Array.from({length:100},(_,i)=>({signature:signature(2000+page*100+i)})));
 const fetchImpl=async(_,options)=>{const {method}=JSON.parse(options.body);return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?null:pages.shift()||[]})}};
 await runCreatorIntelligenceTick({mint,store:h.store,rpcUrl:'https://example.com',fetchImpl,creatorBatchSize:1});
 assert.equal(h.state.creatorPendingSignatures.length,2300);
 assert.deepEqual(new Set(h.state.creatorPendingSignatures),new Set(ids(2300)));
 assert.equal(h.state.creatorHistorySignatures.length,2000);
 assert.equal(h.state.creatorHistoryCursor,signature(2299));
});
test('complete small history remains eligible and repeated ticks do not duplicate evidence',async()=>{
 const event={signature:signature(0),instructionIndex:0,type:'PURCHASE',mint,creator,independentlyVerified:true,instructionVerified:true,settlementVerified:true,timestamp:100,amountRaw:'10'};
 const h=harness({originEvidence:[{creator}],creatorVerifiedAcquisitionEvents:[event],creatorProcessedSignatures:[signature(0)],creatorHistorySignatures:[signature(0)],creatorArchiveCoverageVerified:true,creatorAcquisitionAttributionComplete:true});
 for(let i=0;i<2;i++){
  await tick(h);assert.equal(h.state.creatorHistoryComplete,true);assert.equal(h.state.creatorAcquisitionLedger.scoreEligible,true);
  assert.equal(h.state.creatorAcquisitionLedger.totalAcquiredRaw,'10');assert.equal(h.state.creatorVerifiedAcquisitionEvents.length,1);
 }
 assert.deepEqual(h.methods,['getSignaturesForAddress','getSignaturesForAddress']);
});

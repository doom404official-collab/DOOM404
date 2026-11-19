import test from 'node:test';
import assert from 'node:assert/strict';
import {produceCreatorLaunchDistributions as produce} from '../lib/creatorLaunchDistributionProducer.mjs';
import {assessCreatorInitialAllocation as assess} from '../lib/creatorInitialAllocationEvidence.mjs';
import {classifyVerifiedCreatorAcquisition as classify} from '../lib/creatorVerifiedAcquisitionClassifier.mjs';
import {runCreatorIntelligenceTick} from '../tests/helpers/creatorTickMockLease.mjs';
import {assertCreatorRetention,blockCreatorRetention} from '../lib/creatorRetentionIntegrity.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const input={mint,creator,launchTimestamp:100};
const event=(extra={})=>({mint,creator,type:'LAUNCH_DISTRIBUTION',signature:'1'.repeat(88),instructionIndex:2,innerInstructionIndex:null,amountRaw:'100',timestamp:100,independentlyVerified:true,instructionVerified:true,launchInstructionVerified:true,...extra});
const record=(extra={})=>({mint,recipient:creator,signature:'1'.repeat(88),instructionIndex:2,innerInstructionIndex:null,amountRaw:'100',timestamp:100,verifiedLaunchDistribution:true,instructionVerified:true,...extra});
const observed=distributions=>assess({...input,distributions,coverageComplete:true});
const permutations=xs=>xs.length===0?[[]]:xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(rest=>[x,...rest]));
test('same-signature distinct outer/inner instructions count once each, deterministic exact raw',()=>{
 const rows=[record(),record({innerInstructionIndex:0,amountRaw:'9007199254740993'}),record({instructionIndex:3,amountRaw:'7'})];
 const expected=observed(rows);assert.equal(expected.verifiedObservedRaw,'9007199254741100');assert.equal(expected.evidence.length,3);
 for(const order of permutations(rows))assert.deepEqual(observed([...order,...order]),expected);
});
test('conflicting verified duplicates are withheld in every order',()=>{
 const rows=[record(),record({amountRaw:'200'}),record({instructionIndex:3,amountRaw:'7'})];
 for(const order of permutations(rows)){const r=observed(order);assert.equal(r.verifiedObservedRaw,'7');assert.equal(r.initialAttributableRaw,null);assert.equal(r.coverageComplete,false);assert.equal(r.zeroAllocationVerified,false);}
 for(const extra of [{timestamp:101},{amountRaw:'0'}])assert.equal(observed([record(),record(extra)]).verifiedObservedRaw,'0');
});
test('legacy remains observed only and cannot overlap modern instruction records',()=>{
 const legacy={...record()};delete legacy.instructionIndex;delete legacy.innerInstructionIndex;
 assert.equal(observed([legacy,legacy]).verifiedObservedRaw,'100');assert.equal(observed([legacy]).coverageComplete,false);
 for(const rows of [[legacy,record()],[legacy,{...legacy,amountRaw:'200'}]])for(const order of permutations(rows))assert.equal(observed(order).verifiedObservedRaw,'0');
});
for(const [field,values] of [['instructionVerified',[false,'true',1,{},null]],['verifiedLaunchDistribution',[false,'true',1,{}]],['amountRaw',[-1,1.5,Number.MAX_SAFE_INTEGER+1,{},[],null,'-1','1.2']],['instructionIndex',[-1,1.5,null,undefined]],['innerInstructionIndex',[-1,1.5,undefined,'0']],['signature',['',null,'sig']],['timestamp',[99,NaN,1.5]]])test('malformed target '+field+' withholds completeness and zero',()=>{
 for(const value of values){const r=observed([record({[field]:value})]);assert.equal(r.initialAttributableRaw,null);assert.equal(r.zeroAllocationVerified,false);assert.equal(r.verifiedObservedRaw,'0');}
});
test('unrelated records and coercion objects cannot supply allocation',()=>{
 let invoked=0;const amountRaw={[Symbol.toPrimitive](){invoked++;throw Error('NO_COERCION');}};
 assert.equal(observed([record({amountRaw}),record({mint:creator,amountRaw})]).verifiedObservedRaw,'0');assert.equal(invoked,0);
});
test('classifier retains launch proof and requires exact outer/inner identity',()=>{
 const proof=event(),observation={...proof},good=classify({mint,creator,proof,observation});
 assert.equal(good.status,'VERIFIED');assert.equal(good.event.launchInstructionVerified,true);assert.equal(produce({...input,events:[good.event]}).launchDistributionEvidence.verifiedObservedRaw,'100');
 for(const change of [{innerInstructionIndex:0},{instructionIndex:3},{launchInstructionVerified:'true'},{amountRaw:Number.MAX_SAFE_INTEGER+1}])assert.equal(classify({mint,creator,proof:{...proof,...change},observation}).status,'UNVERIFIED');
 for(const field of ['instructionIndex','innerInstructionIndex']){const missing={...proof};delete missing[field];assert.equal(classify({mint,creator,proof:missing,observation}).status,'UNVERIFIED');}
});
test('producer never promotes buys, movements, missing proofs or exhausted history to coverage',()=>{
 for(const change of [{type:'PURCHASE'},{type:'EXTERNAL_RECEIPT'},{independentlyVerified:'true'},{instructionVerified:1},{launchInstructionVerified:false},{innerInstructionIndex:undefined},{amountRaw:100},{mint:creator},{creator:mint}]){
  const r=produce({...input,events:[event(change)],historyComplete:true,rpcExhausted:true,coverageComplete:true});assert.deepEqual(r.verifiedLaunchDistributions,[]);assert.equal(r.launchDistributionCoverageComplete,false);assert.equal(r.launchDistributionEvidence.initialAttributableRaw,null);assert.equal(r.launchDistributionEvidence.zeroAllocationVerified,false);
 }
 assert.equal(produce({...input,events:[]}).launchDistributionCoverageComplete,false);
});
test('producer resume is idempotent and preserves conflicting and legacy history immutably',()=>{
 const legacy={signature:'old',mint,recipient:creator,amountRaw:'11',timestamp:100,instructionVerified:true,verifiedLaunchDistribution:true,provenance:'retained'};
 const retained=[legacy,record({amountRaw:'200'})],before=structuredClone(retained),events=[event(),event(),event({instructionIndex:4,amountRaw:'9'})];
 const first=produce({...input,retainedDistributions:retained,events});
 const next=produce({...input,retainedDistributions:JSON.parse(JSON.stringify(first.verifiedLaunchDistributions)),events});
 assert.deepEqual(next,first);assert.deepEqual(retained,before);assert.deepEqual(first.verifiedLaunchDistributions.slice(0,2),before);assert.equal(first.launchDistributionEvidence.verifiedObservedRaw,'20');assert.equal(first.launchDistributionCoverageComplete,false);
});
test('selling tick produces/resumes without extra RPC and preserves conflicting source events',async()=>{
 let state={creatorRetentionVersion:1,originEvidence:[{creator}],launchTimestamp:100,creatorHistoryRpcExhausted:true,creatorArchiveCoverageVerified:true,launchDistributionCoverageComplete:true,creatorVerifiedAcquisitionEvents:[event(),event({amountRaw:'200'}),event({instructionIndex:4,amountRaw:'9'})],creatorProcessedSignatures:['retained'],creatorHistorySignatures:['retained'],creatorHistoryCursor:'retained-cursor',initialAllocationEvidence:{initialAttributableRaw:'999'},selling:{creatorSellingScoreEligible:true,windows:[{scoreEligible:true,sellThroughPct:0}]},verifiedLaunchDistributions:[]};
 const original=structuredClone(state.creatorVerifiedAcquisitionEvents),methods=[];
 const args={mint,store:{async get(){return structuredClone({stage:'selling',status:'partial',state});},async claim(){return true;},async save(row){state=JSON.parse(JSON.stringify(row.state));}},rpcUrl:'https://offline.invalid',fetchImpl:async(_,options)=>{const body=JSON.parse(options.body);methods.push(body.method);assert.equal(body.method,'getSignaturesForAddress');return {ok:true,status:200,json:async()=>({result:[]})};}};
 for(let i=0;i<2;i++){
  const r=await runCreatorIntelligenceTick(args);assert.equal(r.errorCode,null);assert.equal(r.requests,1);assert.equal(r.stage,'selling');assert.deepEqual(state.creatorVerifiedAcquisitionEvents,original);assert.equal(state.verifiedLaunchDistributions.length,3);assert.equal(state.initialAllocationEvidence.verifiedObservedRaw,'9');assert.equal(state.initialAllocationEvidence.initialAttributableRaw,null);assert.equal(state.launchDistributionCoverageComplete,false);assert.equal(state.selling.creatorSellingScoreEligible,false);assert.equal(state.selling.windows[0].scoreEligible,false);assert.equal(state.selling.windows[0].sellThroughPct,null);assert.equal(state.sellingStatus,'AWAITING_VERIFIED_INITIAL_ALLOCATION');
 }
 assert.deepEqual(methods,['getSignaturesForAddress','getSignaturesForAddress']);assert.deepEqual(state.creatorProcessedSignatures,['retained']);
});
test('retention blocks without pruning or retaining stale allocation completeness',()=>{
 assert.throws(()=>assertCreatorRetention({verifiedLaunchDistributions:Array(5001).fill(record())}),/CREATOR_RETENTION_BLOCKED/);
 const previous={verifiedLaunchDistributions:[record()],launchDistributionCoverageComplete:true,initialAllocationEvidence:{initialAttributableRaw:'100',coverageComplete:true}};
 const blocked=blockCreatorRetention(previous,'CHECKPOINT_CAPACITY_EXCEEDED');assert.deepEqual(blocked.verifiedLaunchDistributions,previous.verifiedLaunchDistributions);assert.equal(blocked.initialAllocationEvidence.initialAttributableRaw,null);assert.equal(blocked.launchDistributionCoverageComplete,false);assert.equal(previous.launchDistributionCoverageComplete,true);
});
test('provider failure cannot restore stale allocation or selling completeness',async()=>{
 let saved;
 const state={originEvidence:[{creator}],launchTimestamp:100,launchDistributionCoverageComplete:true,initialAllocationEvidence:{initialAttributableRaw:'100',coverageComplete:true},selling:{creatorSellingScoreEligible:true,windows:[{scoreEligible:true,sellThroughPct:0}]},verifiedLaunchDistributions:[record()]};
 const result=await runCreatorIntelligenceTick({mint,store:{async get(){return {stage:'selling',status:'partial',state};},async claim(){return true;},async save(row){saved=row.state;}},rpcUrl:'https://offline.invalid',fetchImpl:async()=>({ok:false,status:401,json:async()=>({})})});
 assert.ok(result.errorCode);assert.equal(saved.launchDistributionCoverageComplete,false);assert.equal(saved.initialAllocationEvidence.initialAttributableRaw,null);assert.equal(saved.selling.creatorSellingScoreEligible,false);assert.equal(saved.selling.windows[0].sellThroughPct,null);assert.deepEqual(saved.verifiedLaunchDistributions,state.verifiedLaunchDistributions);
});

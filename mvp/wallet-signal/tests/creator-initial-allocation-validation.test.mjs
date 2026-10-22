import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCreatorInitialAllocation as assess} from '../lib/creatorInitialAllocationEvidence.mjs';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const input={mint,creator,launchTimestamp:100,coverageComplete:true};
const valid={mint,recipient:creator,verifiedLaunchDistribution:true,instructionVerified:true,signature:'sig',timestamp:100,amountRaw:'100'};
const run=distributions=>assess({...input,distributions});
function incomplete(distributions,total='0'){
 const result=run(distributions);
 assert.equal(result.status,'INITIAL_ALLOCATION_INCOMPLETE');
 assert.equal(result.coverageComplete,false);
 assert.equal(result.initialAttributableRaw,null);
 assert.equal(result.zeroAllocationVerified,false);
 assert.equal(result.verifiedObservedRaw,total);
 return result;
}
test('only literal true verification flags count; invalid target evidence blocks complete and zero claims',()=>{
 for(const field of ['instructionVerified','verifiedLaunchDistribution']){
  for(const value of ['false','true',1,{},[],false,0,null,undefined]){
   const bad={...valid,[field]:value};
   assert.deepEqual(incomplete([bad]).evidence,[]);
   for(const distributions of [[valid,bad],[bad,valid]]){
    assert.deepEqual(incomplete(distributions,'100').evidence,[{signature:'sig',amountRaw:'100'}]);
   }
  }
 }
});
test('malformed target signatures, timestamps and amounts cannot establish allocation completeness',()=>{
 let coercions=0;
 const throwing={[Symbol.toPrimitive](){coercions++;throw Error('MUST_NOT_COERCE');}};
 const changes=[...['',null,undefined,1,{}].map(signature=>({signature})),
  ...[99,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1].map(timestamp=>({timestamp})),
  ...['', '-1','1.5',-1,1.5,Number.MAX_SAFE_INTEGER+1,null,undefined,{},[100],new Number(100),throwing].map(amountRaw=>({amountRaw}))];
 for(const change of changes){
  incomplete([{...valid,...change}]);
  incomplete([valid,{...valid,signature:'bad',...change}],'100');
 }
 assert.equal(coercions,0);
});
test('unrelated or unbound evidence cannot invalidate the target or invoke amount coercion',()=>{
 const amountRaw={[Symbol.toPrimitive](){throw Error('UNRELATED_MUST_NOT_COERCE');}};
 const unrelated=[null,{}, {...valid,mint:creator,amountRaw}, {...valid,recipient:mint,amountRaw}];
 assert.deepEqual(run(unrelated),run([]));
 assert.deepEqual(run([valid,...unrelated]),run([valid]));
});
test('empty covered history, valid zero amounts, duplicates and valid representations retain outputs',()=>{
 assert.deepEqual(run([]),{status:'INITIAL_ALLOCATION_EVIDENCE_COMPLETE',verifiedObservedRaw:'0',initialAttributableRaw:'0',coverageComplete:true,evidence:[],zeroAllocationVerified:true});
 for(const amountRaw of ['0',0,0n,'0001',1,1n,Number.MAX_SAFE_INTEGER,'9007199254740993',9007199254740993n]){
  const event={...valid,amountRaw};
  const expected={status:'INITIAL_ALLOCATION_EVIDENCE_COMPLETE',verifiedObservedRaw:BigInt(amountRaw).toString(),initialAttributableRaw:BigInt(amountRaw).toString(),coverageComplete:true,evidence:[{signature:'sig',amountRaw:String(amountRaw)}],zeroAllocationVerified:BigInt(amountRaw)===0n};
  assert.deepEqual(run([event,event]),expected);
  assert.deepEqual(assess({...input,distributions:[event],coverageComplete:false}),{...expected,status:'INITIAL_ALLOCATION_INCOMPLETE',initialAttributableRaw:null,coverageComplete:false,zeroAllocationVerified:false});
 }
});
test('resumed selling tick preserves incomplete target allocation with mocked RPC and an in-memory store',async()=>{
 for(const instructionVerified of ['false','true',1,{},false]){
  for(const mixed of [false,true]){
   let state={originEvidence:[{creator}],launchTimestamp:100,launchDistributionCoverageComplete:true,verifiedLaunchDistributions:[...(mixed?[valid]:[]),{...valid,signature:'bad',instructionVerified}]};
   const methods=[];
   const result=await runCreatorIntelligenceTick({mint,
    store:{async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}},
    rpcUrl:'https://offline.invalid',fetchImpl:async(_,options)=>{
     const {method}=JSON.parse(options.body);methods.push(method);assert.equal(method,'getSignaturesForAddress');
     return {ok:true,status:200,json:async()=>({result:[]})};
    }});
   assert.equal(result.errorCode,null);
   assert.deepEqual(methods,['getSignaturesForAddress']);
   assert.equal(state.initialAllocationEvidence.initialAttributableRaw,null);
   assert.equal(state.initialAllocationEvidence.zeroAllocationVerified,false);
   assert.equal(state.initialAllocationEvidence.verifiedObservedRaw,mixed?'100':'0');
   assert.equal(state.sellingStatus,'AWAITING_VERIFIED_INITIAL_ALLOCATION');
   assert.equal(result.stage,'selling');
  }
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCreatorAcquisitionLedger} from '../lib/creatorAcquisitionLedger.mjs';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const base={mint,creator,signature:'sig',instructionIndex:0,type:'PURCHASE',amountRaw:'100',timestamp:100,independentlyVerified:true,instructionVerified:true,settlementVerified:true};
const run=events=>summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:true,attributionComplete:true});
const malformed=[-1,1.5,{},'0',Number.MAX_SAFE_INTEGER+1,NaN,Infinity,true,0n];
function rejected(result,detail){
 assert.equal(result.status,'INCOMPLETE');
 assert.equal(result.scoreEligible,false);
 assert.equal(result.sellThroughPct,null);
 assert.equal(result.acceptedCount,1);
 assert.equal(result.totalAcquiredRaw,'100');
 assert.equal(result.rejected.length,1);
 assert.equal(result.rejected[0].reason,'INSUFFICIENT_EVIDENCE');
 assert.equal(result.rejected[0].detail,detail);
}
test('malformed outer and inner instruction identities fail closed beside valid evidence',()=>{
 for(const field of ['instructionIndex','innerInstructionIndex']){
  for(const value of [...malformed,...(field==='instructionIndex'?[null,undefined]:[])]){
   const result=run([base,{...base,signature:'bad',[field]:value}]);
   rejected(result,'INVALID_INSTRUCTION_IDENTITY');
   assert.equal(result.rejected[0].id,null);
  }
 }
});
test('unsafe numeric raw amounts fail closed at the safe-integer boundary',()=>{
 for(const amountRaw of [Number.MAX_SAFE_INTEGER+1,Number.MAX_SAFE_INTEGER+2,1e20,-1,0,1.5,NaN,Infinity,-Infinity]){
  rejected(run([base,{...base,signature:'bad',amountRaw}]),'INVALID_AMOUNT');
 }
});
test('nonprimitive raw amounts are rejected beside valid evidence without coercion',()=>{
 let coercions=0;
 const custom={toString(){coercions++;return '100';},valueOf(){coercions++;return 100;}};
 const throwing={[Symbol.toPrimitive](){coercions++;throw Error('MUST_NOT_COERCE');}};
 for(const amountRaw of [[100],[],{},new Number(100),new String('100'),Object(100n),custom,throwing,null,undefined,true,Symbol('100')]){
  rejected(run([base,{...base,signature:'bad',amountRaw}]),'INVALID_AMOUNT');
 }
 assert.equal(coercions,0);
});
test('valid raw representations and boundary instruction indices preserve complete outputs',()=>{
 for(const amountRaw of [1,'1','0001',1n,Number.MAX_SAFE_INTEGER,String(Number.MAX_SAFE_INTEGER),BigInt(Number.MAX_SAFE_INTEGER),'9007199254740993',9007199254740993n]){
  const expected=run([{...base,amountRaw:String(amountRaw)}]);
  assert.equal(expected.status,'EVIDENCE_READY');
  assert.equal(expected.totalAcquiredRaw,BigInt(amountRaw).toString());
  for(const instructionIndex of [0,1,Number.MAX_SAFE_INTEGER]){
   for(const innerInstructionIndex of [undefined,null,0,1,Number.MAX_SAFE_INTEGER]){
    assert.deepEqual(run([{...base,amountRaw,instructionIndex,innerInstructionIndex}]),expected);
   }
  }
 }
});
test('outer conventions deduplicate while distinct inner instructions remain distinct',()=>{
 const outer={...base,innerInstructionIndex:null};
 assert.deepEqual(run([outer,{...outer}]),run([outer]));
 const result=run([base,{...base,innerInstructionIndex:null},{...base,innerInstructionIndex:0},{...base,innerInstructionIndex:1}]);
 assert.equal(result.acceptedCount,3);
 assert.equal(result.totalAcquiredRaw,'300');
 assert.deepEqual(result.rejected,[]); // Omitted/null inner index are the same outer convention.
});
test('mixed valid event types preserve accounting and sell-through outputs',()=>{
 const types=['LAUNCH_DISTRIBUTION','PURCHASE','EXTERNAL_RECEIPT','EXTERNAL_TRANSFER_OUT','VERIFIED_SALE','INTERNAL_TRANSFER'];
 const events=types.map((type,i)=>({...base,type,signature:String(i),amountRaw:['100','200','50','25','65','999'][i],bothWalletsAttributed:true,launchInstructionVerified:true}));
 assert.deepEqual(run([...events,events[0]]),{
  status:'EVIDENCE_READY',acceptedCount:6,rejected:[],launchRaw:'100',purchasedRaw:'200',externalReceivedRaw:'50',externalTransferredOutRaw:'25',verifiedSoldRaw:'65',totalAcquiredRaw:'350',reconciledRemainingRaw:'260',historyComplete:true,attributionComplete:true,scoreEligible:true,zeroLaunchAllocationVerified:false,sellThroughPct:18.5714
 });
});
test('resumed selling tick rejects malformed persisted acquisitions using only an in-memory store and mock RPC',async()=>{
 for(const changes of [...[-1,1.5,{},'0'].map(innerInstructionIndex=>({innerInstructionIndex})),{instructionIndex:Number.MAX_SAFE_INTEGER+1},{amountRaw:Number.MAX_SAFE_INTEGER+1}]){
  let state={originEvidence:[{creator}],creatorVerifiedAcquisitionEvents:[{...base,...changes}],creatorProcessedSignatures:['sig'],creatorHistorySignatures:['sig'],creatorArchiveCoverageVerified:true,creatorAcquisitionAttributionComplete:true};
  const methods=[];
  const result=await runCreatorIntelligenceTick({mint,
   store:{async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}},
   rpcUrl:'https://offline.invalid',fetchImpl:async(_,options)=>{
    const {method}=JSON.parse(options.body);methods.push(method);
    assert.equal(method,'getSignaturesForAddress');
    return {ok:true,status:200,json:async()=>({result:[]})};
   }});
  assert.equal(result.errorCode,null);
  assert.deepEqual(methods,['getSignaturesForAddress']);
  assert.equal(state.creatorHistoryComplete,true);
  assert.equal(state.creatorAcquisitionLedger.status,'INCOMPLETE');
  assert.equal(state.creatorAcquisitionLedger.scoreEligible,false);
  assert.equal(state.creatorAcquisitionLedger.acceptedCount,0);
  assert.equal(state.creatorAcquisitionLedger.rejected[0].detail,'amountRaw' in changes?'INVALID_AMOUNT':'INVALID_INSTRUCTION_IDENTITY');
 }
});

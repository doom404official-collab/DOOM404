import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCreatorAcquisitionLedger as summarize} from '../lib/creatorAcquisitionLedger.mjs';
import {mergeCreatorAcquisitionEvidence as merge} from '../lib/creatorAcquisitionEvidenceMerge.mjs';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
import {projectCreatorCheckpoint,readDashboardEvidence} from '../lib/dashboardEvidenceBridge.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const event={mint,creator,signature:'sig',instructionIndex:0,type:'PURCHASE',amountRaw:'100',timestamp:100,independentlyVerified:true,instructionVerified:true,settlementVerified:true,launchInstructionVerified:true,bothWalletsAttributed:true};
const run=events=>summarize({mint,creator,events,historyComplete:true,attributionComplete:true});
const types=['LAUNCH_DISTRIBUTION','PURCHASE','EXTERNAL_RECEIPT','EXTERNAL_TRANSFER_OUT','VERIFIED_SALE','INTERNAL_TRANSFER'];
for(const type of types)test(type+' conflicts quarantine the complete identity independent of order',()=>{
 const a={...event,type},b={...a,amountRaw:'101'},invalid={...a,independentlyVerified:'true'};
 for(const changed of [b,{...a,timestamp:101},{...a,type:type==='PURCHASE'?'EXTERNAL_RECEIPT':'PURCHASE'}]){
  const forward=run([a,changed]),reverse=run([changed,a]);
  assert.deepEqual(forward,reverse);assert.equal(forward.acceptedCount,0);assert.equal(forward.totalAcquiredRaw,'0');
  assert.equal(forward.verifiedSoldRaw,'0');assert.equal(forward.externalTransferredOutRaw,'0');assert.equal(forward.scoreEligible,false);
 }
 const expected=run([a,b,invalid]);
 for(const rows of [[b,a,invalid],[invalid,b,a],[b,invalid,a],[a,invalid,b]])assert.deepEqual(run(rows),expected);
 assert.equal(expected.acceptedCount,0);
});
test('semantic duplicates retain exact arithmetic without relying on object order or raw formatting',()=>{
 const reordered=Object.fromEntries(Object.entries({...event,amountRaw:100n,innerInstructionIndex:null}).reverse());
 assert.deepEqual(run([event,reordered,{...event,amountRaw:'000100',diagnostic:'unrelated'}]),run([event]));
 assert.equal(run([event,{...event,innerInstructionIndex:0},{...event,innerInstructionIndex:1}]).totalAcquiredRaw,'300');
 const result=run([{...event,amountRaw:'900719925474099312345'},{...event,signature:'sale',type:'VERIFIED_SALE',amountRaw:'900719925474099312344'}]);
 assert.equal(result.reconciledRemainingRaw,'1');assert.equal(result.sellThroughPct,99.9999);
});
test('proof gates require literal true; invalid same-identity evidence cannot leave a valid total',()=>{
 for(const type of types)for(const key of ['independentlyVerified','instructionVerified',...(type==='PURCHASE'||type==='VERIFIED_SALE'?['settlementVerified']:[]),...(type==='LAUNCH_DISTRIBUTION'?['launchInstructionVerified']:[]),...(type==='INTERNAL_TRANSFER'?['bothWalletsAttributed']:[])]){
  for(const value of [undefined,false,1,'true']){
   const a={...event,type},bad={...a,[key]:value};
   assert.equal(run([a,bad]).acceptedCount,0);assert.deepEqual(run([a,bad]),run([bad,a]));
  }
 }
 for(const changes of [{mint:'other'},{creator:'other'},{type:'UNKNOWN'}])assert.equal(run([event,{...event,...changes}]).acceptedCount,0);
 for(const historyComplete of [undefined,false,1,'true'])assert.equal(summarize({mint,creator,events:[event],historyComplete,attributionComplete:true}).scoreEligible,false);
 for(const attributionComplete of [undefined,false,1,'true'])assert.equal(summarize({mint,creator,events:[event],historyComplete:true,attributionComplete}).scoreEligible,false);
});
test('resume merge preserves immutable prior evidence and all conflicts across event types',()=>{
 for(const type of types){
  const a={...event,type},b={...a,amountRaw:'101'},prior=[a,a,{...a,instructionVerified:false}];
  const snapshot=structuredClone(prior),next=merge(prior,[a,b,b]);
  assert.deepEqual(prior,snapshot);assert.deepEqual(next.slice(0,prior.length),snapshot);assert.equal(next.length,4);
  assert.deepEqual(merge(next,[a,b]),next);assert.equal(run(next).acceptedCount,0);
  next[0].amountRaw='999';assert.deepEqual(prior,snapshot);
 }
});
const updatedAt='2026-10-27T13:00:00Z';
function ready(){
 const events=[{...event,type:'LAUNCH_DISTRIBUTION'}];
 return {mint,status:'partial',stage:'selling',updated_at:updatedAt,state:{originEvidence:[{creator}],launchTimestamp:100,
  creatorVerifiedAcquisitionEvents:events,creatorAcquisitionLedger:run(events),creatorAcquisitionAttributionComplete:true,creatorHistoryComplete:true,
  initialAllocationEvidence:{status:'INITIAL_ALLOCATION_EVIDENCE_COMPLETE',coverageComplete:true,initialAttributableRaw:'100'},
  selling:{methodology:'CREATOR_SELLING_V1_1',creatorSellingScoreEligible:true,windows:[3600,86400,604800].map(seconds=>({seconds,historyComplete:true,scoreEligible:true,verifiedSoldRaw:'0',sellThroughPct:0}))}}};
}
test('actual tick preserves persisted conflicts and clears eligibility without promoting exhausted history',async()=>{
 let row=ready();row.state.creatorVerifiedAcquisitionEvents=[event,{...event,amountRaw:'101'}];
 const original=structuredClone(row.state.creatorVerifiedAcquisitionEvents),calls=[];
 const result=await runCreatorIntelligenceTick({mint,store:{get:async()=>row,claim:async()=>true,save:async v=>{row={...row,...v};}},rpcUrl:'https://offline.invalid',fetchImpl:async(_,options)=>{
  calls.push(JSON.parse(options.body).method);return {ok:true,json:async()=>({result:[]})};
 }});
 assert.equal(result.errorCode,null);assert.deepEqual(calls,['getSignaturesForAddress']);
 assert.deepEqual(row.state.creatorVerifiedAcquisitionEvents,original);assert.equal(row.state.creatorAcquisitionLedger.acceptedCount,0);
 assert.equal(row.state.creatorAcquisitionLedger.scoreEligible,false);assert.equal(row.state.creatorHistoryComplete,false);
 assert.equal(row.stage,'selling');assert.equal(projectCreatorCheckpoint(row,mint).selling,null);
});
test('provider failure invalidates cached numeric eligibility before persistence and leaves history intact',async()=>{
 let row=ready();const original=structuredClone(row.state.creatorVerifiedAcquisitionEvents);let calls=0;
 const result=await runCreatorIntelligenceTick({mint,store:{get:async()=>row,claim:async()=>true,save:async v=>{row={...row,...v};}},rpcUrl:'https://offline.invalid',fetchImpl:async()=>{calls++;return {ok:false,status:401};}});
 assert.ok(result.errorCode);assert.equal(calls,1);assert.deepEqual(row.state.creatorVerifiedAcquisitionEvents,original);
 assert.equal(row.state.creatorAcquisitionLedger.scoreEligible,false);assert.equal(row.state.creatorAcquisitionLedger.sellThroughPct,null);
 assert.equal(projectCreatorCheckpoint(row,mint).selling,null);
});
test('read bridge and scoring adapter withhold stale or legacy ledgers; coherent synthetic evidence keeps unchanged points',async()=>{
 const mutations=[s=>{},s=>s.creatorVerifiedAcquisitionEvents.push({...s.creatorVerifiedAcquisitionEvents[0],amountRaw:'101'}),s=>s.creatorAcquisitionLedger.totalAcquiredRaw='999',s=>delete s.creatorAcquisitionLedger,s=>delete s.creatorVerifiedAcquisitionEvents,s=>s.creatorAcquisitionAttributionComplete='true',s=>s.creatorAcquisitionLedger.scoreEligible='true',s=>s.creatorRetentionBlocked=true,s=>delete s.creatorVerifiedAcquisitionEvents[0].launchInstructionVerified];
 for(const [index,mutate] of mutations.entries()){
  const row=ready();mutate(row.state);const before=structuredClone(row),calls=[];
  const workerEvidence=await readDashboardEvidence({mint,url:'https://offline.invalid',key:'test-only',fetchImpl:async(url,options)=>{
   calls.push(options.method);return {ok:true,json:async()=>url.includes('creator_intelligence_jobs')?[row]:[]};
  }});
  const out=adaptDashboardEvidence({result:{mint,tokenProgram:'spl-token',mintAuthority:null,freezeAuthority:null},now:Date.parse(updatedAt),creatorEvidence:{mint,creator,status:'VERIFIED',independentlyReviewed:true},workerEvidence});
  assert.equal(out.scores.creator_intelligence.components[2].points,index===0?30:null);
  assert.equal(out.scores.creator_intelligence.score,null);assert.deepEqual(calls,['GET','GET']);assert.deepEqual(row,before);
  assert.ok(!JSON.stringify(workerEvidence).includes('test-only'));assert.equal(workerEvidence.creator.creatorVerifiedAcquisitionEvents,undefined);
 }
});

test('shared classifier preserves safe raw and exact instruction identity before normalization for every supported type',async()=>{
 const {classifyVerifiedCreatorAcquisition:classify}=await import('../lib/creatorVerifiedAcquisitionClassifier.mjs');
 for(const type of types.filter(type=>type!=='VERIFIED_SALE')){
  const proof={...event,type,innerInstructionIndex:null},observation={...proof};
  assert.equal(classify({mint,creator,proof,observation}).status,'VERIFIED');
  for(const amountRaw of [Number.MAX_SAFE_INTEGER+1,{},[100],true,null,Symbol('100')]){
   assert.equal(classify({mint,creator,proof:{...proof,amountRaw},observation:{...observation,amountRaw}}).event,null);
  }
  for(const changes of [{instructionIndex:-1},{instructionIndex:Number.MAX_SAFE_INTEGER+1},{innerInstructionIndex:-1},{signature:''}]){
   assert.equal(classify({mint,creator,proof:{...proof,...changes},observation:{...observation,...changes}}).event,null);
  }
  for(const innerInstructionIndex of [0,1,'0'])assert.equal(classify({mint,creator,proof,observation:{...observation,innerInstructionIndex}}).event,null);
  const exact=classify({mint,creator,proof:{...proof,amountRaw:'900719925474099312345'},observation:{...observation,amountRaw:'900719925474099312345'}});
  assert.equal(exact.event.amountRaw,'900719925474099312345');
 }
});

test('new decoded purchase cannot overwrite a conflicting retained purchase during the actual tick',async()=>{
 const {createHash}=await import('node:crypto');
 const {derivePumpFunBondingCurveAccounts}=await import('../lib/pumpFunBondingCurveDerivation.mjs');
 const {PUMP_FUN_PROGRAM_ID}=await import('../lib/pumpFunSellCandidates.mjs');
 const derived=derivePumpFunBondingCurveAccounts({mint}),signature='2'.repeat(88);
 const payload=Buffer.alloc(24);createHash('sha256').update('global:buy').digest().copy(payload,0,0,8);
 payload.writeBigUInt64LE(100n,8);payload.writeBigUInt64LE(200000n,16);
 let number=BigInt('0x'+payload.toString('hex')),data='';const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 while(number>0n){data=alphabet[Number(number%58n)]+data;number/=58n;}
 const tx={blockTime:1700000000,transaction:{message:{accountKeys:[creator,'buyer-ata',derived.poolTokenAccount],instructions:[{programId:PUMP_FUN_PROGRAM_ID,data}]}},meta:{
  err:null,fee:5000,preBalances:[1000000,0,0],postBalances:[895000,0,0],
  preTokenBalances:[{accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'0'}},{accountIndex:2,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'1000'}}],
  postTokenBalances:[{accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'100'}},{accountIndex:2,mint,owner:derived.bondingCurve,uiTokenAmount:{amount:'900'}}],
  innerInstructions:[{index:0,instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{source:derived.poolTokenAccount,destination:'buyer-ata',mint,tokenAmount:{amount:'100'}}}},{program:'system',parsed:{type:'transfer',info:{source:creator,destination:derived.bondingCurve,lamports:100000}}}]}]}};
 const prior={...event,signature,amountRaw:'99',timestamp:1700000000};
 let row=ready();row.state.creatorVerifiedAcquisitionEvents=[prior];row.state.creatorPendingSignatures=[signature];
 const calls=[];
 const result=await runCreatorIntelligenceTick({mint,store:{get:async()=>row,claim:async()=>true,save:async v=>{row={...row,...v};}},rpcUrl:'https://offline.invalid',fetchImpl:async(_,options)=>{
  const {method}=JSON.parse(options.body);calls.push(method);assert.ok(['getSignaturesForAddress','getTransaction'].includes(method));
  return {ok:true,json:async()=>({result:method==='getTransaction'?tx:[]})};
 },buySettlementDecoder:async()=>({signature,instructionIndex:0,mint,creator,amountRaw:'100',solPaidLamports:'100000',timestamp:1700000000,protocolVerified:true,settlementVerified:true,independentlyVerified:true})});
 assert.equal(result.errorCode,null);assert.deepEqual(calls,['getSignaturesForAddress','getTransaction']);
 assert.deepEqual(row.state.creatorVerifiedAcquisitionEvents[0],prior);assert.equal(row.state.creatorVerifiedAcquisitionEvents.length,2);
 assert.equal(row.state.creatorVerifiedAcquisitionEvents[1].amountRaw,'100');assert.equal(row.state.creatorAcquisitionLedger.purchasedRaw,'0');
 assert.equal(row.state.creatorAcquisitionLedger.rejected[0].reason,'CONFLICTING_DUPLICATE');assert.equal(projectCreatorCheckpoint(row,mint).selling,null);
});

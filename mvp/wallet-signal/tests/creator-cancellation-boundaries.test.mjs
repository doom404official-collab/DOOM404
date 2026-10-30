import test from 'node:test';
import assert from 'node:assert/strict';
import {createCreatorExecutionBudget} from '../lib/creatorExecutionBudget.mjs';
import {createCreatorIntelligenceJobStore} from '../lib/creatorIntelligenceJobStore.mjs';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC',owner='offline-owner';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function manualBudget(){let timer;return {budget:createCreatorExecutionBudget({schedule:fn=>{timer=fn;return 1},cancel:()=>{}}),expire:()=>timer()};}
for(const [name,changes] of Object.entries({
 'zero requests':{maxRequests:0},'expanded requests':{maxRequests:501},'fractional requests':{maxRequests:1.1},'string requests':{maxRequests:'5'},
 'zero duration':{maxDurationMs:0},'expanded duration':{maxDurationMs:90001},'bad duration':{maxDurationMs:NaN},
 'zero batch':{creatorBatchSize:0},'expanded batch':{creatorBatchSize:101},'HTTP URL':{rpcUrl:'http://offline.invalid'},'missing host':{rpcUrl:'https://'},
 'missing URL':{rpcUrl:undefined},'invalid owner':{owner:''},'invalid fetch':{fetchImpl:null},'truthy opt-in':{indexedOriginEnabled:'true'},
 'bad swap decoder':{swapDecoder:{}},'bad buy decoder':{buySettlementDecoder:true},'bad budget':{executionBudget:{}},
 'bad mint':{mint:'wrong'}
}))test('configuration before any I/O: '+name,async()=>{
 let activity=0;const touch=async()=>{activity++;throw Error('UNEXPECTED_IO')};
 await assert.rejects(runCreatorIntelligenceTick({mint,owner,rpcUrl:'https://offline.invalid',store:{get:touch,claim:touch,save:touch},fetchImpl:touch,...changes}),error=>/^(INVALID_|HTTPS rpcUrl|invalid )/.test(error.message));
 assert.equal(activity,0);
});
test('missing owner metadata is rejected by the tick itself without provider/save',async()=>{
 for(const lease_owner of [undefined,null,'other-owner']){
  let reads=0,claims=0,providers=0,saves=0;
  const row={mint,status:'partial',stage:'selling',state:{originEvidence:[{creator}]},...(lease_owner===undefined?{}:{lease_owner})};
  await assert.rejects(runCreatorIntelligenceTick({mint,owner,rpcUrl:'https://offline.invalid',store:{get:async()=>{reads++;return row},claim:async()=>{claims++;return true},save:async()=>{saves++;}},fetchImpl:async()=>{providers++;}}),{message:'CREATOR_LEASE_MISMATCH'});
  assert.equal(reads,2);assert.equal(claims,1);assert.equal(providers,0);assert.equal(saves,0);
 }
});
test('parent abort settles non-cooperative operation immediately and cleans up timer',async()=>{
 let signal,cancelled=0,started;
 const ready=new Promise(resolve=>started=resolve),controller=new AbortController(),reason=Error('EXPLICIT_CANCEL');
 const budget=createCreatorExecutionBudget({schedule:()=>1,cancel:()=>cancelled++});
 const pending=budget.run('STORE',s=>{signal=s;started();return new Promise(()=>{})},{signal:controller.signal});
 await ready;controller.abort(reason);
 await assert.rejects(pending,error=>error===reason);assert.equal(signal.aborted,true);assert.equal(cancelled,1);
});
test('already-cancelled parent never invokes operation and produces no orphan rejection',async()=>{
 const controller=new AbortController();controller.abort(Error('ALREADY_CANCELLED'));let calls=0;
 await assert.rejects(createCreatorExecutionBudget().run('READ',()=>{calls++;},{signal:controller.signal}),{message:'ALREADY_CANCELLED'});
 assert.equal(calls,0);await flush();
});
test('late provider response cannot parse body or trigger another checkpoint save',async()=>{
 const timing=manualBudget();let release,started,saves=0,bodyReads=0,signal;
 const ready=new Promise(resolve=>started=resolve);let lease_owner=null;
 const pending=runCreatorIntelligenceTick({mint,owner,executionBudget:timing.budget,rpcUrl:'https://offline.invalid',
  store:{get:async()=>({mint,stage:'selling',status:'partial',lease_owner,state:{originEvidence:[{creator}],launchTimestamp:100}}),claim:async(_mint,value)=>{lease_owner=value;return true},save:async()=>{saves++;return true}},
  fetchImpl:async(_,options)=>{signal=options.signal;started();return new Promise(resolve=>release=resolve)}
 });
 await ready;timing.expire();const result=await pending;
 assert.equal(result.errorCode,'CREATOR_PROVIDER_TIMEOUT');assert.equal(saves,1);assert.equal(signal.aborted,true);
 release({ok:true,json:async()=>{bodyReads++;return {result:[]}}});await flush();
 assert.equal(bodyReads,0);assert.equal(saves,1);
});
test('late store response cannot parse body after its parent cancelled',async()=>{
 const controller=new AbortController();let release,started,bodyReads=0,requests=0;
 const ready=new Promise(resolve=>started=resolve);
 const store=createCreatorIntelligenceJobStore({url:'https://test.supabase.co',key:'offline',fetchImpl:async()=>{requests++;started();return new Promise(resolve=>release=resolve)}});
 const pending=store.save({mint,owner,stage:'selling',state:{}},{signal:controller.signal});
 await ready;controller.abort(Error('EXPLICIT_CANCEL'));
 await assert.rejects(pending,{message:'CREATOR_SAVE_OUTCOME_UNKNOWN'});
 release({ok:true,json:async()=>{bodyReads++;return true}});await flush();
 assert.equal(requests,1);assert.equal(bodyReads,0);
});
test('late claim success cannot start a provider or a checkpoint save',async()=>{
 const timing=manualBudget();let release,started,saves=0,providers=0;
 const ready=new Promise(resolve=>started=resolve);
 const pending=runCreatorIntelligenceTick({mint,owner,executionBudget:timing.budget,rpcUrl:'https://offline.invalid',store:{
  get:async()=>({mint,status:'partial',stage:'selling',lease_owner:null,state:{}}),claim:async()=>{started();return new Promise(resolve=>release=resolve)},save:async()=>{saves++;}
 },fetchImpl:async()=>{providers++;}});
 await ready;timing.expire();await assert.rejects(pending,{message:'CREATOR_CLAIM_OUTCOME_UNKNOWN'});
 release(true);await flush();assert.equal(providers,0);assert.equal(saves,0);
});
test('late save success cannot resume an indexed lookup after reservation uncertainty',async()=>{
 const timing=manualBudget();let release,started,saves=0,providers=0,lease_owner=null;
 const ready=new Promise(resolve=>started=resolve);
 const pending=runCreatorIntelligenceTick({mint,owner,executionBudget:timing.budget,indexedOriginEnabled:true,rpcUrl:'https://offline.invalid',store:{
  get:async()=>({mint,status:'partial',stage:'identification',lease_owner,state:{}}),claim:async(_mint,value)=>{lease_owner=value;return true},save:async()=>{saves++;started();return new Promise(resolve=>release=resolve)}
 },fetchImpl:async()=>{providers++;}});
 await ready;timing.expire();await assert.rejects(pending,{message:'CREATOR_SAVE_OUTCOME_UNKNOWN'});
 release(true);await flush();assert.equal(providers,0);assert.equal(saves,1);
});

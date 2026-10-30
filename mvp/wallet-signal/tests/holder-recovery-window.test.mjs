import test from 'node:test';
import assert from 'node:assert/strict';
import {readHolderRecoveryWindow,recoveryWindowOpen} from '../lib/holderRecoveryWindow.mjs';
import {createHolderRecoveryBudget} from '../lib/holderRecoveryBudget.mjs';
const now=Date.parse('2026-01-01T00:10:00.000Z');
const config=()=>({GLITCH_HOLDER_RECOVERY_START_AT:'2026-01-01T00:00:00.000Z',GLITCH_HOLDER_RECOVERY_EXPIRES_AT:'2026-01-01T00:20:00.000Z',GLITCH_HOLDER_RECOVERY_JOB_C670_VERSION:'7',GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION:'11'});
test('strict twenty-minute window pins both versions and freezes configuration',()=>{
 const w=readHolderRecoveryWindow(config(),now);assert.deepEqual(Object.values(w.versions),[7,11]);assert.ok(Object.isFrozen(w)&&Object.isFrozen(w.versions));assert.equal(recoveryWindowOpen(w,w.startsAt),true);assert.equal(recoveryWindowOpen(w,w.expiresAt),false);assert.equal(recoveryWindowOpen(w,w.startsAt-1),false);
});
for(const [key,value] of [
 ['GLITCH_HOLDER_RECOVERY_START_AT',undefined],['GLITCH_HOLDER_RECOVERY_EXPIRES_AT',undefined],
 ['GLITCH_HOLDER_RECOVERY_START_AT','2026-01-01'],['GLITCH_HOLDER_RECOVERY_START_AT','2026-02-30T00:00:00.000Z'],
 ['GLITCH_HOLDER_RECOVERY_EXPIRES_AT','2026-01-01T00:20:00.001Z'],['GLITCH_HOLDER_RECOVERY_EXPIRES_AT','2026-01-01T00:00:00.000Z'],
 ['GLITCH_HOLDER_RECOVERY_EXPIRES_AT','2026-01-01T01:20:00.000+01:00'],
 ...['','-1','1.5','07','7e0',' 7','9007199254740991','9007199254740992',undefined].map(v=>['GLITCH_HOLDER_RECOVERY_JOB_C670_VERSION',v]),
 ['GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION',undefined]
])test('malformed window/version disabled: '+key+' '+String(value),()=>{assert.throws(()=>readHolderRecoveryWindow({...config(),[key]:value},now),/RECOVERY_WINDOW_DISABLED/);});
test('same enabled deployment expires without environment mutation',()=>{
 const env=config(),before=JSON.stringify(env);for(const time of [now-600001,now+600000,now+600001])assert.throws(()=>readHolderRecoveryWindow(env,time),/RECOVERY_WINDOW_DISABLED/);assert.equal(JSON.stringify(env),before);
});
test('absolute expiry cancels active operation and blocks every later store/provider operation',async()=>{
 let mono=0,wall=now,fire,signal,calls=0;
 const budget=createHolderRecoveryBudget({now:()=>mono,wallNow:()=>wall,notAfter:now+1000,schedule:(fn,ms)=>{assert.equal(ms,1000);fire=fn;return 1;},cancel:()=>{}});
 const pending=budget.run('CLAIM',s=>{calls++;signal=s;return new Promise(()=>{});});while(!signal)await Promise.resolve();mono=1000;wall=now+1000;fire();await assert.rejects(pending,/CLAIM_TIMEOUT/);assert.equal(signal.aborted,true);
 for(const label of ['READ','CLAIM','PROVIDER','RENEW','COMMIT'])await assert.rejects(()=>budget.run(label,()=>{calls++;},{provider:label==='PROVIDER'}),/TIMEOUT/);
 assert.equal(calls,1);
});
test('wall clock expiry rejects late parse despite delayed monotonic timer',async()=>{
 let wall=now,calls=0;const budget=createHolderRecoveryBudget({now:()=>0,wallNow:()=>wall,notAfter:now+1000,schedule:()=>1,cancel:()=>{}});
 await assert.rejects(()=>budget.run('READ',()=>{wall=now+1000;return {}; }),/READ_TIMEOUT/);
 await assert.rejects(()=>budget.run('CLAIM',()=>calls++),/CLAIM_TIMEOUT/);assert.equal(calls,0);
});
test('actual store serialization crossing expiry cannot start a fetch',async()=>{
 const {createHolderJobStore}=await import('../lib/holderJobStore.mjs');let wall=now,calls=0;
 const budget=createHolderRecoveryBudget({now:()=>0,wallNow:()=>wall,notAfter:now+1000,schedule:()=>1,cancel:()=>{}});
 const store=createHolderJobStore({url:'https://offline.invalid',key:'offline',fetchImpl:async()=>{calls++;throw Error('MUST_NOT_FETCH');}});
 const checkpoint={toJSON(){wall=now+1001;return {mint:'mint'};}};
 await assert.rejects(()=>budget.run('COMMIT',signal=>store.commit('job','worker',7,checkpoint,{},'partial',{signal})),/COMMIT_TIMEOUT/);assert.equal(calls,0);
});

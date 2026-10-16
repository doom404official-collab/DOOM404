import test from 'node:test';
import assert from 'node:assert/strict';
import {admitCustomerScan} from './customerScanAdmission.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
function deps(overrides={}){
 const calls=[];
 return {calls,args:{mint,authorization:'Bearer token',enabled:true,
 verifyUser:async()=>({id:'trusted-user'}),store:{getLatest:async()=>null,createOrReuse:async()=>{calls.push('create');return {id:'job1',status:'queued'};}},
 lockManager:{acquire:async()=>{calls.push('lock');return {mint,owner:'owner'};},release:async()=>{calls.push('release');}},
 quota:{admit:async()=>{calls.push('quota');return true;}},prepareSnapshot:async()=>{calls.push('snapshot');return {mint};},...overrides}};
}
test('disabled endpoint does not perform work',async()=>{const d=deps({enabled:false});assert.equal((await admitCustomerScan(d.args)).status,503);assert.deepEqual(d.calls,[]);});
test('unauthenticated requests do not access jobs',async()=>{const d=deps({verifyUser:async()=>null});assert.equal((await admitCustomerScan(d.args)).status,401);assert.deepEqual(d.calls,[]);});
test('existing job reused without quota or snapshot',async()=>{const d=deps({store:{getLatest:async()=>({id:'old',status:'partial'})}});const r=await admitCustomerScan(d.args);assert.equal(r.body.jobId,'old');assert.deepEqual(d.calls,[]);});
test('concurrent loser does not consume quota',async()=>{const d=deps({lockManager:{acquire:async()=>null}});assert.equal((await admitCustomerScan(d.args)).body.status,'preparing');assert.deepEqual(d.calls,[]);});
test('quota denial releases lock and does not create job',async()=>{const d=deps({quota:{admit:async()=>false}});assert.equal((await admitCustomerScan(d.args)).status,429);assert.deepEqual(d.calls,['lock','release']);});
test('new job created once and lock released',async()=>{const d=deps();const r=await admitCustomerScan(d.args);assert.equal(r.body.jobId,'job1');assert.deepEqual(d.calls,['lock','quota','snapshot','create','release']);});
test('snapshot failure still releases lock',async()=>{const d=deps({prepareSnapshot:async()=>{throw Error('rpc unavailable');}});await assert.rejects(()=>admitCustomerScan(d.args));assert.deepEqual(d.calls,['lock','quota','release']);});

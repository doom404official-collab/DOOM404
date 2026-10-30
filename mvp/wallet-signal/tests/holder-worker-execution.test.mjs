import test from 'node:test';
import assert from 'node:assert/strict';
import {runBoundedHolderWorker,createHolderWorkerBudget,boundedHolderStore,holderExecutionFailure} from '../lib/holderWorkerExecution.mjs';
import {createHolderHistoryCheckpoint} from '../lib/holderHistoryCheckpoint.mjs';
import {processEvidenceBatch} from '../lib/holderEvidenceBatch.mjs';
import {createHolderEvidenceStore} from '../lib/holderEvidenceStore.mjs';
import {createHolderJobStore} from '../lib/holderJobStore.mjs';
function clock(){let t=0,id=0;const timers=new Map();return {now:()=>t,schedule:(fn,ms)=>{timers.set(++id,{fn,at:t+ms});return id;},cancel:id=>timers.delete(id),advance(ms){t+=ms;for(const [id,x] of timers)if(x.at<=t){timers.delete(id);x.fn();}},get pending(){return timers.size;}};}
class Store{
 constructor(){this.calls=[];this.row={id:'ordinary-job',mint:'mint',version:10,status:'partial',lease_owner:null,lease_expires_at:null,summary:{score:9.93},checkpoint:createHolderHistoryCheckpoint({mint:'mint',holders:Array.from({length:20},(_,i)=>({ownerWallet:'wallet'+i,tokenAccount:'account'+i,sharePct:1}))})};this.row.checkpoint.signatures.old='checked';}
 async claim(id,owner,seconds){this.calls.push('claim');if(this.row.lease_owner)return null;Object.assign(this.row,{lease_owner:owner,lease_expires_at:new Date(Date.now()+seconds*1000).toISOString(),status:'running',version:this.row.version+1});return structuredClone(this.row);}
 async renew(id,owner,v,seconds){this.calls.push('renew');assert.equal(owner,this.row.lease_owner);assert.equal(v,this.row.version);this.row.version++;return structuredClone(this.row);}
 async commit(id,owner,v,checkpoint,summary,status){this.calls.push('commit');assert.equal(v,this.row.version);Object.assign(this.row,{checkpoint,summary,status,version:v+1,lease_owner:null,lease_expires_at:null});return structuredClone(this.row);}
}
const args=s=>({store:s,jobId:s.row.id,maxRequests:20,rpc:async()=>[]});
test('ordinary identity is not a recovery allowlist; versions, summary and history survive',async()=>{
 const s=new Store(),r=await runBoundedHolderWorker({...args(s),maxRequests:1});assert.equal(r.jobId,'ordinary-job');assert.equal(r.version,13);assert.equal(r.requestCount,1);assert.equal(s.row.summary.score,9.93);assert.equal(s.row.checkpoint.signatures.old,'checked');assert.deepEqual(s.calls,['claim','renew','commit']);
});
test('slow successful providers stop by30s and persist prior completed work',async()=>{
 const s=new Store(),c=clock(),starts=[];const r=await runBoundedHolderWorker({...args(s),budget:createHolderWorkerBudget(c),rpc:async()=>{starts.push(c.now());c.advance(7000);return [];}});
 assert.ok(starts.length<20);assert.ok(starts.every(t=>t<30000));assert.equal(r.status,'partial');assert.equal(s.row.checkpoint.signatures.old,'checked');assert.ok(s.row.checkpoint.wallets.wallet0.pages>0);assert.equal(c.pending,0);
});
for(const stage of ['claim','renew','commit'])test(stage+' timeout/late response is uncertain and never retried',async()=>{
 const s=new Store(),c=clock(),original=s[stage].bind(s);let abort=false;
 s[stage]=async(...a)=>{a.at(-1).signal.addEventListener('abort',()=>abort=true);const row=await original(...a);c.advance(8001);return row;};
 const r=await runBoundedHolderWorker({...args(s),maxRequests:1,budget:createHolderWorkerBudget(c)});
 assert.equal(r.status,stage.toUpperCase()+'_OUTCOME_UNKNOWN');assert.equal(r.retryAllowed,false);assert.equal(r.reconciliationRequired,true);assert.equal(abort,true);assert.equal(s.calls.filter(x=>x===stage).length,1);if(stage==='claim')assert.equal(r.requestCount,0);if(stage==='renew')assert.ok(!s.calls.includes('commit'));
});
test('long checkpoint parsing cannot start provider work after deadline',async()=>{
 const s=new Store(),c=clock(),claim=s.claim.bind(s);s.claim=async(...a)=>{const row=await claim(...a);c.advance(51000);return row;};let calls=0;
 const r=await runBoundedHolderWorker({...args(s),rpc:async()=>{calls++;},budget:createHolderWorkerBudget(c)});assert.equal(calls,0);assert.equal(r.status,'CLAIM_OUTCOME_UNKNOWN');assert.equal(s.row.checkpoint.signatures.old,'checked');
});
for(const stage of ['renew','commit'])test(stage+' lease/version rejection preserves checkpoint and reports reconciliation',async()=>{
 const s=new Store(),before=structuredClone(s.row.checkpoint);s[stage]=async()=>null;const r=await runBoundedHolderWorker({...args(s),maxRequests:1});assert.equal(r.status,stage==='renew'?'LEASE_LOST':'VERSION_CONFLICT');assert.equal(r.retryAllowed,false);assert.deepEqual(s.row.checkpoint,before);
});
test('concurrent ordinary workers claim once; resumed invocation uses saved checkpoint',async()=>{
 const s=new Store();const r=await Promise.all([runBoundedHolderWorker({...args(s),maxRequests:1}),runBoundedHolderWorker({...args(s),maxRequests:1})]);assert.equal(r.filter(x=>x.status==='ALREADY_CLAIMED').length,1);const index=s.row.checkpoint.nextWalletIndex;await runBoundedHolderWorker({...args(s),maxRequests:1});assert.notEqual(s.row.checkpoint.nextWalletIndex,index);assert.equal(s.row.checkpoint.signatures.old,'checked');
});
test('evidence deadline preserves prior finishes and leaves remaining claims unmodified',async()=>{
 const c=clock(),budget=createHolderWorkerBudget(c),saved=[],calls=[];const checkpoint={wallets:{a:{}},holders:[],edges:{a:{signatures:['one','two','three']}}};
 const r=await processEvidenceBatch({jobId:'job',checkpoint,store:{seed:async()=>3,claim:async()=>['one','two','three'].map(signature=>({signature,attempts:0})),finish:async(id,sig)=>{saved.push(sig);c.advance(30000);return true;}},rpc:(m,p)=>budget.run('PROVIDER',()=>{calls.push(p[0]);return null;},{provider:true})});
 assert.equal(r.interrupted,true);assert.equal(r.processed,1);assert.deepEqual(saved,['one']);assert.deepEqual(calls,['one']);
});
test('store transports forward cancellation through evidence methods and scheduler selection',async()=>{
 const signal=new AbortController().signal;let calls=0;
 const fetchImpl=async(url,o)=>{calls++;assert.equal(o.signal,signal);return {ok:true,json:async()=>url.includes('health')?{total:0,pending:0,verified:0,rejected:0,unavailable:0,active_leases:0,expired_leases:0,retry_exhausted:0}:url.includes('seed')?0:url.includes('finish')?true:[]};};
 const s=createHolderEvidenceStore({url:'https://offline.invalid',key:'test',fetchImpl});await s.nextJob({signal});await s.health({signal});await s.seed('j',{signal});await s.claim('j','w',6,{signal});await s.finish('j','sig','w',{status:'unavailable',evidence:{},attempts:1},{signal});await s.listForJob('j',{signal});
 await createHolderJobStore({url:'https://offline.invalid',key:'test',fetchImpl}).getNextRunnable({signal});assert.equal(calls,7);
});
test('bounded mutations report only allowlisted stage/status, never transport secrets',async()=>{
 const state={},s=boundedHolderStore({finish:async()=>{throw Error('https://secret.invalid?token=secret');}},createHolderWorkerBudget(),{finish:{write:true}},state);
 await assert.rejects(()=>s.finish());const r=holderExecutionFailure(state,{jobId:'job'});assert.equal(r.status,'FINISH_OUTCOME_UNKNOWN');assert.ok(!JSON.stringify(r).includes('secret'));assert.equal(r.retryAllowed,false);
});
test('cancelled provider result arriving later cannot change persisted checkpoint',async()=>{
 const s=new Store(),c=clock();let release,signal;
 const task=runBoundedHolderWorker({...args(s),maxRequests:1,budget:createHolderWorkerBudget(c),rpc:async(m,p,o)=>{signal=o.signal;return new Promise(r=>release=r);}});
 while(!release)await Promise.resolve();c.advance(8001);const r=await task;assert.equal(signal.aborted,true);assert.equal(r.status,'partial');const before=JSON.stringify(s.row.checkpoint);release([{signature:'late',slot:1,err:null}]);await Promise.resolve();assert.equal(JSON.stringify(s.row.checkpoint),before);
});
test('hung store signal cancels and no following operation starts',async()=>{
 const c=clock(),state={};let signal;const s=boundedHolderStore({getById:async(id,o)=>{signal=o.signal;return new Promise(()=>{});}},createHolderWorkerBudget(c),{getById:{}},state);
 const task=s.getById('job');while(!signal)await Promise.resolve();c.advance(8001);await assert.rejects(task,/TIMEOUT/);assert.equal(signal.aborted,true);assert.equal(state.uncertain,undefined);
});
test('evidence finish timeout is uncertain and later claims are never processed',async()=>{
 const c=clock(),state={},finished=[];const s=boundedHolderStore({seed:async()=>2,claim:async()=>[{signature:'one',attempts:0},{signature:'two',attempts:0}],finish:async(id,sig)=>{finished.push(sig);c.advance(8001);return true;}},createHolderWorkerBudget(c),{seed:{write:true},claim:{write:true},finish:{write:true}},state);
 await assert.rejects(()=>processEvidenceBatch({jobId:'job',checkpoint:{wallets:{},edges:{},holders:[]},store:s,rpc:async()=>null}),/EVIDENCE_FINISH_FAILED/);assert.deepEqual(finished,['one']);assert.equal(state.uncertain,'FINISH');assert.equal(holderExecutionFailure(state).retryAllowed,false);
});
for(const ceiling of [20,25])test('ordinary request ceiling remains '+ceiling,async()=>{
 const s=new Store();for(let i=0;i<100;i++)s.row.checkpoint.signatures['pending'+i]='pending';let calls=0;
 const r=await runBoundedHolderWorker({...args(s),maxRequests:ceiling,rpc:async method=>{calls++;return method==='getTransaction'?null:[];}});assert.equal(r.requestCount,ceiling);assert.equal(calls,ceiling);assert.equal(s.row.checkpoint.signatures.old,'checked');
});
test('seven-second evidence operation ceiling is stricter than the shared maximum',async()=>{
 const c=clock(),budget=createHolderWorkerBudget(c);let signal;
 await assert.rejects(()=>budget.run('PROVIDER',s=>{signal=s;c.advance(7001);return null;},{provider:true,maxOperationMs:7000}),/PROVIDER_TIMEOUT/);assert.equal(signal.aborted,true);
 await assert.rejects(()=>budget.run('PROVIDER',()=>null,{maxOperationMs:9000}),/INVALID_OPERATION_BUDGET/);
});
for(const field of ['version','lease_owner','mint'])test('renewal identity mismatch '+field+' cannot commit',async()=>{
 const s=new Store(),renew=s.renew.bind(s);s.renew=async(...a)=>{const row=await renew(...a);row[field]=field==='version'?999:'wrong';return row;};const r=await runBoundedHolderWorker({...args(s),maxRequests:1});assert.equal(r.status,'RENEW_OUTCOME_UNKNOWN');assert.ok(!s.calls.includes('commit'));
});

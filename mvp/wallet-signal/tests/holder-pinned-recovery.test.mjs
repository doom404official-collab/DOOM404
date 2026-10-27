import {holderNetworkSnapshotIdentity} from '../lib/holderNetworkCheckpoint.mjs';
import {createHolderRecoveryBudget} from '../lib/holderRecoveryBudget.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHolderHistoryCheckpoint} from '../lib/holderHistoryCheckpoint.mjs';
import {runPinnedHolderRecovery} from '../lib/holderPinnedRecovery.mjs';
import {createHolderJobStore} from '../lib/holderJobStore.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const ids=['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4'];
function fixture(i=0){
 const checkpoint=createHolderHistoryCheckpoint({mint,holders:Array.from({length:20},(_,n)=>({ownerWallet:'wallet'+n,tokenAccount:'token'+n,amountRaw:'100',sharePct:1}))});
 checkpoint.nextWalletIndex=[18,4][i];
 checkpoint.snapshot={slot:457305617,supplyRaw:'10000',excluded_wallets:['incinerator']};
 checkpoint.signatures={historical:'checked',retry:'pending'};
 checkpoint.edges={'wallet0|wallet1':{walletA:'wallet0',walletB:'wallet1',signatures:['historical']}};
 checkpoint.failedSignatures={oldFailure:'retained'};
 checkpoint.networkEvidence={version:1,snapshotIdentity:holderNetworkSnapshotIdentity(checkpoint),processed:{historical:{valid:true,transferCount:1}},transfers:[{signature:'historical',amountRaw:'7'}],retentionLimited:false};
 for(const w of Object.values(checkpoint.wallets)){w.pages=12;w.signaturesSeen=1200;w.cursor='old-cursor';}
 return {id:ids[i],mint,version:[2134,1812][i],status:'running',lease_owner:'expired-worker',lease_expires_at:'2026-01-01T00:00:00Z',checkpoint,summary:{score:9.93,scorePromoted:false,methodology:'TOP20_NETWORK_V1'}};
}
class Store{
 constructor(){this.rows=ids.map((_,i)=>fixture(i));this.calls=[];}
 get row(){return this.rows[0];}
 async getById(id){this.calls.push('read');return structuredClone(this.rows.find(r=>r.id===id));}
 async claim(id,worker,seconds){
  this.calls.push('claim');const r=this.rows.find(r=>r.id===id);
  if(r.lease_owner&&Date.parse(r.lease_expires_at)>Date.now())return null;
  r.lease_owner=worker;r.lease_expires_at=new Date(Date.now()+seconds*1000).toISOString();r.status='running';r.version++;
  return structuredClone(r);
 }
 async renew(id,worker,version,seconds){
  this.calls.push('renew');const r=this.rows.find(r=>r.id===id);
  if(r.lease_owner!==worker||r.version!==version||Date.parse(r.lease_expires_at)<=Date.now())return null;
  r.version++;r.lease_expires_at=new Date(Date.now()+seconds*1000).toISOString();return structuredClone(r);
 }
 async commit(id,worker,version,checkpoint,summary,status){
  this.calls.push('commit');const r=this.rows.find(r=>r.id===id);
  if(r.lease_owner!==worker||r.version!==version||Date.parse(r.lease_expires_at)<=Date.now())return null;
  Object.assign(r,{version:version+1,checkpoint:structuredClone(checkpoint),summary,status,lease_owner:null,lease_expires_at:null});return structuredClone(r);
 }
}
const args=(store,i=0)=>({store,jobId:ids[i],mint,expectedVersion:[2134,1812][i],rpc:async(method)=>method==='getTransaction'?null:[],maxRequests:2});
for(let i=0;i<2;i++)test('pins candidate '+ids[i]+' with prototype-bound store methods',async()=>{
 const s=new Store(),before=structuredClone(s.rows);const result=await runPinnedHolderRecovery(args(s,i));
 assert.equal(result.status,'partial');assert.equal(result.requestCount,2);assert.equal(result.version,before[i].version+3);
 assert.deepEqual(s.rows[1-i],before[1-i]);assert.deepEqual(s.rows[i].checkpoint.snapshot,before[i].checkpoint.snapshot);
 assert.deepEqual(s.rows[i].checkpoint.networkEvidence,before[i].checkpoint.networkEvidence);
 assert.deepEqual(s.rows[i].checkpoint.edges,before[i].checkpoint.edges);assert.equal(s.rows[i].summary.score,9.93);
 assert.equal(s.rows[i].checkpoint.archiveCompletenessProven,false);assert.deepEqual(s.calls,['read','claim','renew','commit']);
});
test('real store REST projection supplies all lease fields and exact claim/renew/commit arguments',async()=>{
 const model=new Store(),requests=[];
 const store=createHolderJobStore({url:'https://offline.invalid',key:'fixture',fetchImpl:async(url,options)=>{
  requests.push({url,options});let result;
  if(options.method==='GET'){const u=new URL(url);assert.equal(u.searchParams.get('id'),'eq.'+ids[0]);assert.match(u.searchParams.get('select'),/lease_owner,lease_expires_at/);result=[await model.getById(ids[0])];}
  else{const b=JSON.parse(options.body);const op=url.split('/').at(-1);
   if(op==='glitch_claim_holder_scan')result=await model.claim(b.p_job_id,b.p_worker,b.p_lease_seconds);
   if(op==='glitch_renew_holder_scan')result=await model.renew(b.p_job_id,b.p_worker,b.p_expected_version,b.p_lease_seconds);
   if(op==='glitch_commit_holder_scan')result=await model.commit(b.p_job_id,b.p_worker,b.p_expected_version,b.p_checkpoint,b.p_summary,b.p_status);
  }
  return {ok:true,status:200,json:async()=>structuredClone(result)};
 }});
 assert.equal((await runPinnedHolderRecovery(args(store))).status,'partial');assert.equal(requests.length,4);
 assert.equal(JSON.parse(requests[2].options.body).p_expected_version,2135);assert.equal(JSON.parse(requests[3].options.body).p_expected_version,2136);
});
for(const field of ['lease_owner','lease_expires_at'])test('missing '+field+' prevents claim and RPC',async()=>{
 const s=new Store();delete s.row[field];await assert.rejects(runPinnedHolderRecovery(args(s)),/LEASE_METADATA/);assert.deepEqual(s.calls,['read']);
});
for(const mutate of [r=>r.lease_owner=undefined,r=>r.lease_expires_at='invalid',r=>r.lease_expires_at=new Date(Date.now()+60000).toISOString(),r=>r.checkpoint.wallets=null,r=>r.checkpoint.nextWalletIndex=-1,r=>r.checkpoint.holders[0]={},r=>r.checkpoint.archiveCompletenessProven='false'])test('malformed or active preflight fails before claim',async()=>{
 const s=new Store();mutate(s.row);await assert.rejects(runPinnedHolderRecovery(args(s)),/RECOVERY_/);assert.deepEqual(s.calls,['read']);
});
for(const mutate of [r=>r.version++,r=>r.id=ids[1],r=>r.mint='wrong',r=>r.checkpoint.mint='wrong',r=>delete r.lease_owner,r=>r.lease_expires_at='invalid',r=>r.checkpoint.wallets.wallet0.pages++])test('claim identity/version/checkpoint race rejects before RPC',async()=>{
 const s=new Store(),claim=s.claim.bind(s);s.claim=async(...a)=>{const r=await claim(...a);mutate(r);return r;};
 let calls=0;await assert.rejects(runPinnedHolderRecovery({...args(s),rpc:async()=>calls++}),/CLAIM_VERSION/);assert.equal(calls,0);assert.deepEqual(s.calls,['read','claim']);
});
test('concurrent claims perform only one scan/commit',async()=>{
 const s=new Store();const result=await Promise.all([runPinnedHolderRecovery(args(s)),runPinnedHolderRecovery(args(s))]);
 assert.deepEqual(result.map(x=>x.status).sort(),['ALREADY_CLAIMED','partial']);assert.equal(s.calls.filter(x=>x==='commit').length,1);
});
test('failed renewal preserves stored checkpoint despite in-memory engine mutations',async()=>{
 const s=new Store(),before=structuredClone(s.row.checkpoint);s.renew=async()=>null;
 assert.equal((await runPinnedHolderRecovery(args(s))).status,'LEASE_LOST');assert.deepEqual(s.row.checkpoint,before);assert.ok(!s.calls.includes('commit'));
});
for(const mutate of [r=>r.version++,r=>r.id=ids[1],r=>r.lease_owner='other',r=>r.lease_expires_at='invalid',r=>r.checkpoint.mint='wrong'])test('malformed renewal cannot commit',async()=>{
 const s=new Store(),renew=s.renew.bind(s);s.renew=async(...a)=>{const r=await renew(...a);mutate(r);return r;};
 await assert.rejects(runPinnedHolderRecovery(args(s)),/RENEW_IDENTITY/);assert.ok(!s.calls.includes('commit'));
});
test('stale commit never overwrites the authoritative checkpoint',async()=>{
 const s=new Store(),before=structuredClone(s.row.checkpoint),commit=s.commit.bind(s);s.commit=async(...a)=>{s.row.version++;return commit(...a);};
 assert.equal((await runPinnedHolderRecovery(args(s))).status,'VERSION_CONFLICT');assert.deepEqual(s.row.checkpoint,before);
});
for(const persisted of [true,false])test('uncertain commit is never retried; persisted='+persisted,async()=>{
 const s=new Store(),before=structuredClone(s.row.checkpoint),commit=s.commit.bind(s);let n=0;
 s.commit=async(...a)=>{n++;if(persisted)await commit(...a);throw Error('lost response');};
 const result=await runPinnedHolderRecovery(args(s));assert.equal(result.status,'COMMIT_OUTCOME_UNKNOWN');assert.equal(n,1);
 if(!persisted)assert.deepEqual(s.row.checkpoint,before);else assert.notDeepEqual(s.row.checkpoint,before);
});
test('interrupted provider scan saves bounded progress and resumes without duplicate evidence',async()=>{
 const s=new Store(),before=structuredClone(s.row.checkpoint);let n=0;
 const first=await runPinnedHolderRecovery({...args(s),maxRequests:20,rpc:async(method)=>{n++;if(n===3)throw Error('FIXTURE_INTERRUPTION');return method==='getTransaction'?null:[{signature:'historical',err:null,slot:10},{signature:'new',err:null,slot:9}];}});
 assert.equal(first.status,'partial');assert.equal(first.requestCount,3);assert.equal(s.row.summary.reason,'FIXTURE_INTERRUPTION');
 assert.equal(s.row.checkpoint.signatures.new,'pending');assert.deepEqual(s.row.checkpoint.networkEvidence,before.networkEvidence);
 const saved=structuredClone(s.row.checkpoint);await runPinnedHolderRecovery({...args(s),expectedVersion:s.row.version});
 assert.equal(s.row.checkpoint.signatures.new,'pending');assert.deepEqual(s.row.checkpoint.edges,saved.edges);assert.deepEqual(s.row.checkpoint.snapshot,before.snapshot);
});
test('process interruption before commit leaves checkpoint resumable after lease expiry',async()=>{
 const s=new Store(),before=structuredClone(s.row.checkpoint),renew=s.renew.bind(s);
 s.renew=async()=>{throw Error('PROCESS_INTERRUPTED');};await assert.rejects(runPinnedHolderRecovery(args(s)),/PROCESS_INTERRUPTED/);assert.deepEqual(s.row.checkpoint,before);
 s.row.lease_expires_at='2026-01-01T00:00:00Z';s.renew=renew;
 assert.equal((await runPinnedHolderRecovery({...args(s),expectedVersion:s.row.version})).status,'partial');
});
test('hard budget actually reaches exactly twenty requests, never twenty-one',async()=>{
 const s=new Store();for(let i=0;i<250;i++)s.row.checkpoint.signatures['pending'+i]='pending';let n=0;
 const result=await runPinnedHolderRecovery({...args(s),maxRequests:20,rpc:async()=>{n++;return null;}});assert.equal(n,20);assert.equal(result.requestCount,20);
});
for(const override of [{maxRequests:21},{maxRequests:0},{leaseSeconds:89},{leaseSeconds:181}])test('budget rejects '+JSON.stringify(override),async()=>{
 const s=new Store();await assert.rejects(runPinnedHolderRecovery({...args(s),...override}),/BUDGET/);assert.deepEqual(s.calls,[]);
});

test('repeated newly decoded transaction remains one retained transfer across resume',async()=>{
 const s=new Store(),cp=s.row.checkpoint,signature='2'.repeat(88),from='3'.repeat(32),to='4'.repeat(32);
 delete cp.networkEvidence;cp.signatures={[signature]:'pending'};
 const tx={slot:42,meta:{err:null,innerInstructions:[]},transaction:{signatures:[signature],message:{accountKeys:[from,to],instructions:[{program:'system',programId:'11111111111111111111111111111111',parsed:{type:'transfer',info:{source:from,destination:to,lamports:7}}}]}}};
 const rpc=async(method)=>method==='getTransaction'?tx:[{signature,slot:42,err:null}];
 await runPinnedHolderRecovery({...args(s),rpc,maxRequests:2});
 assert.equal(s.row.checkpoint.networkEvidence.transfers.length,1);
 const first=structuredClone(s.row.checkpoint.networkEvidence);
 await runPinnedHolderRecovery({...args(s),rpc,maxRequests:2,expectedVersion:s.row.version});
 assert.deepEqual(s.row.checkpoint.networkEvidence,first);assert.equal(s.row.summary.score,9.93);
});
test('provider exhaustion retains explicit archive Unknown and frozen snapshot',async()=>{
 const s=new Store(),snapshot=structuredClone(s.row.checkpoint.snapshot);s.row.checkpoint.signatures={historical:'checked'};
 const result=await runPinnedHolderRecovery({...args(s),rpc:async()=>[],maxRequests:20});
 assert.equal(result.status,'complete');assert.equal(s.row.summary.providerHistoryExhausted,true);
 assert.equal(s.row.summary.archiveCompletenessProven,false);assert.equal(s.row.checkpoint.archiveCompletenessProven,false);
 assert.deepEqual(s.row.checkpoint.snapshot,snapshot);assert.equal(s.row.summary.scorePromoted,false);
});
test('bad commit identity reports uncertainty without retry',async()=>{
 const s=new Store(),commit=s.commit.bind(s);let n=0;s.commit=async(...a)=>{n++;const r=await commit(...a);r.id=ids[1];return r;};
 const r=await runPinnedHolderRecovery(args(s));assert.equal(r.status,'COMMIT_OUTCOME_UNKNOWN');assert.equal(r.retryAllowed,false);assert.equal(r.reconciliationRequired,true);assert.equal(n,1);
});

test('eight-megabyte checkpoint preserves retained history through the real worker',async()=>{
 const s=new Store(),cp=s.row.checkpoint;
 // Synthetic, not copied live evidence. Parent reported 7.6–8.3 MB checkpoints.
 const evidence=cp.networkEvidence;
 evidence.transfers=Array.from({length:9500},(_,i)=>({signature:String(i).padStart(88,'0'),slot:450097547,
  from:'3'.repeat(44),to:'4'.repeat(44),assetType:'TOKEN',mint,amountRaw:'12345678901234567890',
  verifiedOnChain:true,transferVerified:true,sourceTokenAccount:'5'.repeat(44),destinationTokenAccount:'6'.repeat(44)}));
 evidence.processed={};
 for(let i=0;i<15000;i++){const signature=String(i).padStart(88,'0');cp.signatures[signature]='checked';evidence.processed[signature]={valid:true,transferCount:i<9500?1:0};}
 const bytes=Buffer.byteLength(JSON.stringify(cp));assert.ok(bytes>=7_500_000&&bytes<=9_000_000,`fixture bytes ${bytes}`);
 const original=JSON.stringify(evidence),snapshot=JSON.stringify(cp.snapshot);
 const start=performance.now();const result=await runPinnedHolderRecovery(args(s));
 assert.equal(result.status,'partial');assert.equal(result.requestCount,2);
 assert.equal(JSON.stringify(s.row.checkpoint.networkEvidence),original);assert.equal(JSON.stringify(s.row.checkpoint.snapshot),snapshot);
 assert.equal(s.row.summary.score,9.93);assert.equal(s.row.checkpoint.signatures.retry,'pending');
 console.log(`Large synthetic recovery checkpoint: ${bytes} bytes; ${Math.round(performance.now()-start)} ms (local diagnostic only)`);
});

function fakeClock(){
 let time=0,next=0;const timers=new Map();
 const clock={now:()=>time,schedule:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:time+ms});return id;},cancel:id=>timers.delete(id),advance(ms){
  const end=time+ms;
  while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;timers.delete(due[0]);due[1].fn();}
  time=end;
 },get pending(){return timers.size;}};
 return clock;
}
test('slow successful provider stops at 30s and persists prior progress within reserved time',async()=>{
 const clock=fakeClock(),s=new Store(),before=structuredClone(s.row.checkpoint),started=[];
 for(const name of ['getById','claim','renew','commit']){const fn=s[name].bind(s);s[name]=async(...a)=>{clock.advance(7000);return fn(...a);};}
 let cancelled=false;
 const r=await runPinnedHolderRecovery({...args(s),maxRequests:20,budget:createHolderRecoveryBudget(clock),rpc:async(method,params,{signal})=>{
  started.push(clock.now());signal.addEventListener('abort',()=>cancelled=true,{once:true});clock.advance(7000);return method==='getTransaction'?null:[];
 }});
 assert.deepEqual(started,[14000,21000,28000]);assert.equal(cancelled,true);assert.equal(r.status,'partial');assert.equal(r.requestCount,3);
 assert.equal(s.row.summary.reason,'RECOVERY_PROVIDER_TIMEOUT');assert.ok(clock.now()<50000);assert.equal(clock.pending,0);
 assert.deepEqual(s.row.checkpoint.networkEvidence,before.networkEvidence);assert.deepEqual(s.row.checkpoint.snapshot,before.snapshot);assert.equal(s.row.checkpoint.signatures.retry,'pending');
});
test('expired provider budget does not start a request',async()=>{
 const clock=fakeClock(),budget=createHolderRecoveryBudget(clock);clock.advance(30000);let calls=0;
 await assert.rejects(budget.run('PROVIDER',()=>calls++,{provider:true}),/PROVIDER_TIMEOUT/);assert.equal(calls,0);assert.equal(clock.pending,0);
});
test('hung provider is aborted and late completion cannot mutate committed progress',async()=>{
 const clock=fakeClock(),s=new Store();let release,signalSeen;
 const task=runPinnedHolderRecovery({...args(s),budget:createHolderRecoveryBudget(clock),rpc:(method,params,{signal})=>{signalSeen=signal;return new Promise(resolve=>{release=resolve;});}});
 while(!release)await Promise.resolve();clock.advance(8000);
 const result=await task;assert.equal(result.status,'partial');assert.equal(signalSeen.aborted,true);
 const saved=structuredClone(s.row.checkpoint);release([{signature:'late',slot:1,err:null}]);await Promise.resolve();await Promise.resolve();
 assert.deepEqual(s.row.checkpoint,saved);assert.equal(saved.signatures.retry,'pending');assert.equal(clock.pending,0);
});
for(const phase of ['fetch','body'])for(const stage of ['getById','claim','renew','commit'])test('hung '+stage+' aborts actual store '+phase,async()=>{
 const clock=fakeClock(),model=new Store(),before=structuredClone(model.row.checkpoint);let blockedSignal,resolveBody;const calls=[];
 const names={glitch_claim_holder_scan:'claim',glitch_renew_holder_scan:'renew',glitch_commit_holder_scan:'commit'};
 const store=createHolderJobStore({url:'https://offline.invalid',key:'fixture',fetchImpl:async(url,opts)=>{
  const name=opts.method==='GET'?'getById':names[url.split('/').at(-1)];calls.push(name);
  if(name===stage){blockedSignal=opts.signal;if(phase==='fetch')return new Promise(resolve=>resolveBody=resolve);return {ok:true,status:200,json:()=>new Promise(resolve=>resolveBody=resolve)};}
  const b=opts.body?JSON.parse(opts.body):{};
  const value=name==='getById'?[await model.getById(ids[0])]:name==='claim'?await model.claim(b.p_job_id,b.p_worker,b.p_lease_seconds):name==='renew'?await model.renew(b.p_job_id,b.p_worker,b.p_expected_version,b.p_lease_seconds):await model.commit(b.p_job_id,b.p_worker,b.p_expected_version,b.p_checkpoint,b.p_summary,b.p_status);
  return {ok:true,status:200,json:async()=>value};
 }});
 // Attach rejection handler before advancing the deterministic timer.
 const outcome=runPinnedHolderRecovery({...args(store),budget:createHolderRecoveryBudget(clock)}).then(value=>({value}),error=>({error}));
 while(!resolveBody)await Promise.resolve();clock.advance(8000);const result=await outcome;
 assert.equal(blockedSignal.aborted,true);assert.deepEqual(model.row.checkpoint,before);
 if(stage==='getById'){assert.match(result.error.message,/READ_TIMEOUT/);assert.deepEqual(calls,['getById']);}
 else{assert.equal(result.value.status,{claim:'CLAIM_OUTCOME_UNKNOWN',renew:'RENEWAL_OUTCOME_UNKNOWN',commit:'COMMIT_OUTCOME_UNKNOWN'}[stage]);assert.equal(result.value.retryAllowed,false);}
 if(stage!=='commit')assert.ok(!calls.includes('commit'));
 resolveBody(null);await Promise.resolve();assert.deepEqual(model.row.checkpoint,before);assert.equal(clock.pending,0);
});
test('commit timeout after server persistence remains uncertain without replay',async()=>{
 const clock=fakeClock(),s=new Store(),commit=s.commit.bind(s);let signalSeen,release,n=0;
 s.commit=async(...a)=>{n++;await commit(...a);signalSeen=a.at(-1).signal;return new Promise(resolve=>release=resolve);};
 const task=runPinnedHolderRecovery({...args(s),budget:createHolderRecoveryBudget(clock)});
 while(!release)await Promise.resolve();clock.advance(8000);const result=await task;
 assert.equal(result.status,'COMMIT_OUTCOME_UNKNOWN');assert.equal(result.retryAllowed,false);assert.equal(signalSeen.aborted,true);assert.equal(n,1);assert.equal(s.row.version,2137);
 const saved=structuredClone(s.row);release(saved);await Promise.resolve();assert.deepEqual(s.row,saved);
});
test('total budget rejects store work before starting after 50s',async()=>{
 const clock=fakeClock(),budget=createHolderRecoveryBudget(clock);clock.advance(50000);let calls=0;
 await assert.rejects(budget.run('COMMIT',()=>calls++),/COMMIT_TIMEOUT/);assert.equal(calls,0);
});
for(const mutate of [cp=>delete cp.version,cp=>cp.version=2,cp=>cp.version='1',cp=>cp.networkEvidence.version=2,cp=>cp.networkEvidence=null,cp=>cp.networkEvidence.processed=[],cp=>cp.networkEvidence.transfers={},cp=>cp.networkEvidence.snapshotIdentity='mismatch',cp=>cp.networkEvidence.retentionLimited=true,cp=>cp.networkEvidence.processed.historical.transferCount=2,cp=>cp.networkEvidence.processed.historical.valid='true',cp=>cp.networkEvidence.transfers[0].signature='foreign'])test('incompatible schema/evidence is rejected before claim',async()=>{
 const s=new Store();mutate(s.row.checkpoint);const before=structuredClone(s.row);
 await assert.rejects(runPinnedHolderRecovery(args(s)),/RECOVERY_(CHECKPOINT_SCHEMA|NETWORK_)/);assert.deepEqual(s.calls,['read']);assert.deepEqual(s.row,before);
});
test('legacy missing raw balances and snapshot are preserved with matching ordered identity',async()=>{
 const s=new Store(),cp=s.row.checkpoint;delete cp.snapshot;for(const h of cp.holders)delete h.amountRaw;
 cp.networkEvidence.snapshotIdentity=holderNetworkSnapshotIdentity(cp);const original=structuredClone(cp.holders);
 assert.ok(!cp.networkEvidence.snapshotIdentity.includes('amountRaw'));
 assert.equal((await runPinnedHolderRecovery(args(s))).status,'partial');assert.deepEqual(s.row.checkpoint.holders,original);assert.equal(Object.hasOwn(s.row.checkpoint,'snapshot'),false);
});

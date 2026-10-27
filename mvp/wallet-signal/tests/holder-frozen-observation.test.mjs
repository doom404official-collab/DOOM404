import test from 'node:test';
import assert from 'node:assert/strict';
import {readHolderFrozenObservation,projectHolderFrozenObservation} from '../lib/holderFrozenObservation.mjs';
import {HOLDER_RETAIN19_POLICY as p} from '../lib/holderEligibleViewPolicy.mjs';
const fixture=()=>({id:p.snapshotId,mint:p.mint,slot:p.slot,status:'frozen',supply_raw:'1000',excluded_wallets:['1nc1nerator11111111111111111111111111111111'],holder_ranking:[p.infrastructurePool,...Array.from({length:19},(_,i)=>'2'.repeat(31)+'123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[i])].map(wallet=>({wallet,balance:'10'}))});
test('exact stored snapshot read is GET-only, bounded, allowlisted and independent of jobs',async()=>{
 const s=fixture(),before=JSON.stringify(s);let calls=0;
 const r=await readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async(url,options)=>{
  calls++;const u=new URL(url);assert.equal(u.pathname,'/rest/v1/glitch_top20_snapshots');assert.equal(u.searchParams.get('id'),'eq.'+p.snapshotId);assert.equal(u.searchParams.get('mint'),'eq.'+p.mint);assert.equal(u.searchParams.get('limit'),'2');assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);return {ok:true,json:async()=>[s]};
 }});
 assert.equal(calls,1);assert.deepEqual(r.snapshot,s);assert.equal(r.observation.originalTop20.sharePct,20);assert.equal(r.observation.eligible.sharePct,19);assert.equal(r.finalScore,null);assert.equal(r.jobAssociationVerified,false);assert.equal(r.snapshotProvenanceVerified,false);assert.equal(JSON.stringify(s),before);assert.equal(r.jobId,undefined);
});
test('unapproved mint never contacts the store',async()=>{assert.equal((await readHolderFrozenObservation('other',{fetchImpl:()=>{throw Error('MUST_NOT_FETCH');}})).status,'not_applicable');});
for(const [name,rows] of [['missing',[]],['duplicate',[fixture(),fixture()]],['shape',{}],['wrong id',[{...fixture(),id:'other'}]],['wrong slot',[{...fixture(),slot:1}]],['missing supply',[{...fixture(),supply_raw:null}]],['numeric raw',[{...fixture(),supply_raw:1000}]]])test('stored contract fails closed: '+name,async()=>{
 const read=()=>readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async()=>({ok:true,json:async()=>rows})});
 if(name==='missing')assert.equal((await read()).status,'unavailable');else await assert.rejects(read,/FROZEN_|SCOPE/);
});
test('provider rejection and timeout stay unavailable',async()=>{
 for(const fetchImpl of [async()=>({ok:false}),async()=>{throw new DOMException('timeout','TimeoutError');}])await assert.rejects(()=>readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl}));
});
test('public observation strips unrelated stored columns and never mutates retained history',()=>{
 const s={...fixture(),private_note:'not public',job_id:'not an association'},r=projectHolderFrozenObservation(s);
 assert.equal(r.snapshot.private_note,undefined);assert.equal(r.snapshot.job_id,undefined);assert.equal(r.observation.scorePromoted,false);r.snapshot.holder_ranking[0].balance='0';assert.equal(s.holder_ranking[0].balance,'10');
});

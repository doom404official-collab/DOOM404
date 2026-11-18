import test from 'node:test';
import assert from 'node:assert/strict';
import {readHolderFrozenObservation,projectHolderFrozenObservation} from '../lib/holderFrozenObservation.mjs';
import {HOLDER_RETAIN19_POLICY as p} from '../lib/holderEligibleViewPolicy.mjs';
const fixture=()=>({id:p.snapshotId,mint:p.mint,slot:p.slot,status:'frozen',supply_raw:'1000',excluded_wallets:['1nc1nerator11111111111111111111111111111111'],holder_ranking:[p.infrastructurePool,...Array.from({length:19},(_,i)=>'2'.repeat(31)+'123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[i])].map(wallet=>({wallet,balance:'10'}))});
const hosted=()=>{const {slot,...s}=fixture();return {...s,snapshot_slot:slot,supply_definition:'mint-total-supply-not-circulating'};};
test('exact stored snapshot read is GET-only, bounded, allowlisted and independent of jobs',async()=>{
 const s=hosted(),before=JSON.stringify(s);let calls=0;
 const r=await readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async(url,options)=>{
  calls++;const u=new URL(url);assert.equal(u.pathname,'/rest/v1/glitch_top20_snapshots');assert.equal(u.searchParams.get('id'),'eq.'+p.snapshotId);assert.equal(u.searchParams.get('mint'),'eq.'+p.mint);assert.equal(u.searchParams.get('limit'),'2');assert.equal(u.searchParams.get('select'),'id,mint,snapshot_slot,status,supply_definition,supply_raw,holder_ranking,excluded_wallets');assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);return {ok:true,json:async()=>[s]};
 }});
 assert.equal(calls,1);assert.deepEqual(r.snapshot,{...fixture(),supply_definition:'mint-total-supply-not-circulating'});assert.equal(r.snapshot.snapshot_slot,undefined);assert.equal(r.observation.originalTop20.sharePct,20);assert.equal(r.observation.eligible.sharePct,19);assert.equal(r.finalScore,null);assert.equal(r.jobAssociationVerified,false);assert.equal(r.snapshotProvenanceVerified,false);assert.equal(JSON.stringify(s),before);assert.equal(r.jobId,undefined);
});
test('unapproved mint never contacts the store',async()=>{assert.equal((await readHolderFrozenObservation('other',{fetchImpl:()=>{throw Error('MUST_NOT_FETCH');}})).status,'not_applicable');});
for(const [name,rows] of [['missing',[]],['duplicate',[hosted(),hosted()]],['shape',{}],['wrong id',[{...hosted(),id:'other'}]],['wrong slot',[{...hosted(),snapshot_slot:1}]],['missing supply',[{...hosted(),supply_raw:null}]],['numeric raw',[{...hosted(),supply_raw:1000}]]])test('stored contract fails closed: '+name,async()=>{
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

for(const slot of [undefined,null,'457305617',457305617.5,-1,Number.MAX_SAFE_INTEGER+1])test('hosted slot rejects missing/noninteger/unsafe value '+String(slot),async()=>{
 await assert.rejects(()=>readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async()=>({ok:true,json:async()=>[{...hosted(),snapshot_slot:slot,slot:p.slot}]})}),/FROZEN_STORE_INVALID_SLOT/);
});

test('actual hosted numeric balance shape canonicalizes exactly and preserves ranks without mutation',async()=>{
 const row={...hosted(),supply_definition:'mint-total-supply-not-circulating',supply_raw:'880020402606516',holder_ranking:hosted().holder_ranking.map((h,i)=>({...h,rank:i+1,balance:i===0?53465669147912:10}))};
 const before=JSON.stringify(row);
 const r=await readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async()=>({ok:true,json:async()=>[row]})});
 assert.equal(r.snapshot.slot,457305617);assert.equal(r.snapshot.supply_raw,'880020402606516');assert.equal(r.snapshot.holder_ranking[0].balance,'53465669147912');assert.deepEqual(r.snapshot.holder_ranking.map(h=>h.rank),Array.from({length:20},(_,i)=>i+1));assert.equal(JSON.stringify(row),before);
 assert.equal(r.observation.originalTop20.numeratorRaw,'53465669148102');assert.equal(r.observation.eligible.numeratorRaw,'190');assert.equal(r.finalScore,null);
});
for(const balance of [Number.MAX_SAFE_INTEGER+1,-1,0.5,NaN,Infinity,null,{},true,'1e3',' 10','1.2','-1'])test('hosted raw balance rejects malformed value '+String(balance),async()=>{
 const row=hosted();row.holder_ranking[0].balance=balance;
 await assert.rejects(()=>readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async()=>({ok:true,json:async()=>[row]})}),/FROZEN_STORE_INVALID_BALANCE/);
});
test('safe numeric limits and arbitrarily precise raw strings survive without rounding',async()=>{
 const row=hosted();row.supply_raw='999999999999999999999999999999';row.holder_ranking[0].balance=Number.MAX_SAFE_INTEGER;row.holder_ranking[1].balance='123456789012345678901234';row.holder_ranking[2].balance=0;
 const r=await readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async()=>({ok:true,json:async()=>[row]})});
 assert.equal(r.snapshot.holder_ranking[0].balance,'9007199254740991');assert.equal(r.snapshot.holder_ranking[1].balance,'123456789012345678901234');assert.equal(r.snapshot.holder_ranking[2].balance,'0');assert.equal(r.snapshot.supply_raw,row.supply_raw);
});

test('unknown supply definition cannot silently substitute circulating supply',async()=>{
 for(const supply_definition of [undefined,'circulating'])await assert.rejects(()=>readHolderFrozenObservation(p.mint,{url:'https://example.invalid',key:'offline',fetchImpl:async()=>({ok:true,json:async()=>[{...hosted(),supply_definition}]})}),/FROZEN_STORE_INVALID_SUPPLY_DEFINITION/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalHolderCollectionRow,verifyHolderCollectionLineage,isVerifiedHolderCollectionLineage} from './fixtures/archived-holder-policy.mjs';
import {readHolderFrozenObservation} from './fixtures/archived-holder-policy.mjs';
import {HOLDER_RETAIN19_POLICY as p} from './fixtures/archived-holder-policy.mjs';
const fixture=()=>({id:p.snapshotId,mint:p.mint,slot:p.slot,status:'frozen',supply_definition:'mint-total-supply-not-circulating',supply_raw:'1000',excluded_wallets:['1nc1nerator11111111111111111111111111111111'],holder_ranking:[p.infrastructurePool,...Array.from({length:19},(_,i)=>'2'.repeat(31)+'123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[i])].map((wallet,i)=>({wallet,balance:String(30-i),rank:i+1}))});
test('synthetic canonical bytes reproduce historical layout but cannot satisfy pinned receipt',async()=>{
 const s=fixture(),before=JSON.stringify(s),canonical=canonicalHolderCollectionRow(s);
 assert.equal(canonical,JSON.stringify({mint:s.mint,slot:s.slot,supply:1000,eligible:s.holder_ranking.map(h=>({...h,balance:Number(h.balance)})),excludedWallets:s.excluded_wallets}));
 assert.notEqual(createHash('sha256').update(canonical).digest('hex'),p.snapshotId);
 const r=await verifyHolderCollectionLineage({...s,collectionLineage:{status:'verified',canonicalRowHashVerified:true}});
 assert.equal(r.status,'unverified');assert.equal(isVerifiedHolderCollectionLineage(r),false);assert.equal(JSON.stringify(s),before);
});
test('malformed ranks, identities, amounts and exclusion arrays fail closed',async()=>{
 for(const mutate of [s=>delete s.holder_ranking[0].rank,s=>s.holder_ranking.reverse(),s=>s.holder_ranking[1].wallet=s.holder_ranking[0].wallet,s=>delete s.holder_ranking[2],s=>s.holder_ranking[0].wallet='bad',s=>s.id='foreign',s=>s.mint='foreign',s=>s.slot++,s=>s.status='partial',s=>delete s.supply_definition,s=>s.excluded_wallets=[],s=>s.excluded_wallets.push(s.excluded_wallets[0]),s=>delete s.excluded_wallets[0]]){
  const s=fixture();mutate(s);assert.throws(()=>canonicalHolderCollectionRow(s));assert.equal((await verifyHolderCollectionLineage(s)).status,'unverified');
 }
 for(const value of [undefined,null,false,10,-1,1.5,NaN,Infinity,'01','1e3',' 1','-1','9007199254740992'])for(const field of ['supply','balance']){
  const s=fixture();if(field==='supply')s.supply_raw=value;else s.holder_ranking[0].balance=value;
  assert.equal((await verifyHolderCollectionLineage(s)).status,'unverified');
 }
});
test('missing digest capability, digest failure and cancellation remain unverified',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
  assert.equal((await verifyHolderCollectionLineage(fixture())).status,'unverified');
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest:async()=>{throw Error('offline');}}}});
  assert.equal((await verifyHolderCollectionLineage(fixture())).status,'unverified');
  let calls=0,finish;
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}}}});
  const controller=new AbortController();controller.abort();
  assert.equal((await verifyHolderCollectionLineage(fixture(),{signal:controller.signal})).status,'unverified');assert.equal(calls,0);
  const later=new AbortController(),pending=verifyHolderCollectionLineage(fixture(),{signal:later.signal});
  later.abort();finish(new Uint8Array(32).buffer);assert.equal((await pending).status,'unverified');assert.equal(calls,1);
 }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto;}
});
test('API projection discards supplied receipt flags without extra store requests or score promotion',async()=>{
 const s=fixture();let calls=0;
 const r=await readHolderFrozenObservation(p.mint,{url:'https://database.invalid',key:'synthetic',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>[{...s,snapshot_slot:s.slot,collectionLineage:{status:'verified'},snapshotProvenanceVerified:true}]};}});
 assert.equal(calls,1);assert.equal(r.collectionLineage.status,'unverified');assert.equal(r.snapshot.collectionLineage,undefined);
 assert.equal(r.snapshotProvenanceVerified,false);assert.equal(r.jobAssociationVerified,false);assert.equal(r.finalScore,null);assert.equal(r.observation.component.max,35);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {runTop20Job} from './runTop20Job.mjs';
const id='a'.repeat(64);
const holders=Array.from({length:20},(_,i)=>({wallet:'holder'+i,balance:20-i,rank:i+1}));
function mockVault(saved=[]){
 const batches=[...saved];
 return {batches,getFrozen:async()=>({holder_ranking:holders}),getBatches:async()=>batches,
  saveBatch:async({snapshotId,startIndex,results,coverage,status})=>{
   batches.push({snapshot_id:snapshotId,start_index:startIndex,wallet_results:results,coverage,status});
  }};
}
test('one run processes all twenty in four persisted batches',async()=>{
 const vault=mockVault();let calls=0;
 const r=await runTop20Job({snapshotId:id,rpcUrl:'https://example.org',vault,
  discover:async()=>{calls++;return {edges:[],coverage:{failed:0,failedPage:false}};}});
 assert.equal(r.status,'sampled_not_final');
 assert.equal(calls,20);assert.equal(vault.batches.length,4);
});
test('completed batches are skipped on resumption',async()=>{
 const vault=mockVault([{start_index:0,status:'complete'}]);let calls=0;
 const r=await runTop20Job({snapshotId:id,rpcUrl:'https://example.org',vault,
  discover:async()=>{calls++;return {edges:[],coverage:{failed:0,failedPage:false}};}});
 assert.equal(r.status,'sampled_not_final');assert.equal(calls,15);
});
test('partial history checkpoint prevents false completion',async()=>{
 const vault=mockVault();
 const r=await runTop20Job({snapshotId:id,rpcUrl:'https://example.org',vault,
  discover:async()=>({edges:[],coverage:{failed:1}})});
 assert.equal(r.status,'partial');assert.equal(vault.batches[0].status,'partial');
 assert.equal(vault.batches.length,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createTop20Vault} from './top20Vault.mjs';
const snapshot={id:'a'.repeat(64),mint:'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',
 slot:123,supply:1000,holders:[{wallet:'holder',balance:100,rank:1}],excludedWallets:[]};
test('frozen snapshot write verifies persisted identity and ranking',async()=>{
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,method:opts.method});
  return {ok:true,status:200,text:async()=>opts.method==='GET'?JSON.stringify([{
   id:snapshot.id,mint:snapshot.mint,snapshot_slot:123,supply_raw:'1000',holder_ranking:snapshot.holders
  }]):''};
 };
 const vault=createTop20Vault({url:'https://vault.example',serviceRoleKey:'test-secret',fetchImpl});
 assert.equal(await vault.saveFrozen(snapshot),snapshot.id);
 assert.deepEqual(calls.map(c=>c.method),['POST','GET']);
});
test('conflicting existing batch cannot be silently overwritten',async()=>{
 const fetchImpl=async()=>({ok:true,status:200,text:async()=>JSON.stringify([{
  status:'complete',wallet_results:[{wallet:'different'}],coverage:{}
 }])});
 const vault=createTop20Vault({url:'https://vault.example',serviceRoleKey:'test-secret',fetchImpl});
 await assert.rejects(()=>vault.saveBatch({snapshotId:snapshot.id,startIndex:0,
  results:[{wallet:'holder'}],coverage:{},status:'complete'}),/Existing batch differs/);
});
test('missing service key rejected',()=>{
 assert.throws(()=>createTop20Vault({url:'https://vault.example'}));
});

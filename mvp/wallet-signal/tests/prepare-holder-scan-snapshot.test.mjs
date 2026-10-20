import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey} from '@solana/web3.js';
import {prepareHolderScanSnapshot} from '../lib/prepareHolderScanSnapshot.mjs';
const pk=n=>new PublicKey(Uint8Array.from({length:32},()=>n));
const mint=pk(1).toBase58(),program='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
function fixture(){
 const largest={context:{slot:100},value:Array.from({length:20},(_,i)=>({address:pk(i+2),amount:'10'}))};
 const supply={context:{slot:101},value:{amount:'1000'}};
 const accounts=largest.value.map(()=>({context:{slot:102},value:{owner:new PublicKey(program),data:{parsed:{type:'account',info:{owner:pk(25).toBase58(),mint}}}}}));
 const connection={getTokenLargestAccounts:async()=>largest,getTokenSupply:async()=>supply,getParsedAccountInfo:async(address,config)=>{
  assert.equal(config.minContextSlot,101);return accounts[largest.value.findIndex(x=>x.address.equals(address))];
 }};
 return {largest,supply,accounts,connection};
}
test('retains raw balances and dated multi-slot provenance, aggregates wallet history once',async()=>{
 const f=fixture();const r=await prepareHolderScanSnapshot({mint,connection:f.connection});
 assert.equal(r.checkpoint.holders.length,20);assert.equal(Object.keys(r.checkpoint.wallets).length,1);
 assert.equal(r.checkpoint.holders[0].amountRaw,'10');assert.equal(r.checkpoint.snapshot.supplyRaw,'1000');
 assert.deepEqual(r.checkpoint.snapshot.ownerSlots,Array(20).fill(102));assert.equal(r.checkpoint.snapshot.sameSlot,false);
 assert.equal(r.checkpoint.archiveCompletenessProven,false);
});
for(const [name,mutate,error] of [
 ['malformed supply',f=>f.supply.value.amount='1e3','INVALID_TOKEN_SUPPLY'],
 ['zero supply',f=>f.supply.value.amount='0','INVALID_TOKEN_SUPPLY'],
 ['negative amount',f=>f.largest.value[0].amount='-1','INVALID_HOLDER_ACCOUNT'],
 ['duplicate account',f=>f.largest.value[1].address=f.largest.value[0].address,'INVALID_HOLDER_ACCOUNT'],
 ['aggregate exceeds supply',f=>f.largest.value.forEach(x=>x.amount='60'),'INVALID_HOLDER_SUPPLY'],
 ['missing source slot',f=>delete f.largest.context,'SNAPSHOT_CONTEXT_MISSING'],
 ['regressed supply slot',f=>f.supply.context.slot=99,'SNAPSHOT_CONTEXT_REGRESSED'],
 ['regressed owner slot',f=>f.accounts[0].context.slot=100,'SNAPSHOT_OWNER_CONTEXT_INVALID'],
 ['wrong mint',f=>f.accounts[0].value.data.parsed.info.mint=pk(27).toBase58(),'HOLDER_ACCOUNT_IDENTITY_MISMATCH'],
 ['wrong program',f=>f.accounts[0].value.owner=pk(28),'HOLDER_ACCOUNT_IDENTITY_MISMATCH'],
 ['wrong account type',f=>f.accounts[0].value.data.parsed.type='mint','HOLDER_ACCOUNT_IDENTITY_MISMATCH'],
 ['unresolved owner',f=>delete f.accounts[0].value.data.parsed.info.owner,'HOLDER_OWNER_UNRESOLVED']
])test('rejects '+name,async()=>{const f=fixture();mutate(f);await assert.rejects(prepareHolderScanSnapshot({mint,connection:f.connection}),new RegExp(error));});

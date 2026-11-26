import test from 'node:test';
import assert from 'node:assert/strict';
import {Keypair} from '@solana/web3.js';
import {buildCanonicalHolderSnapshot} from '../lib/canonicalHolderSnapshot.mjs';
const token='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',system='11111111111111111111111111111111';
const key=i=>Keypair.fromSeed(Uint8Array.from({length:32},(_,n)=>(i+n)%256)).publicKey.toBase58();
function fixture(){
 const mint=key(100),wallets=Array.from({length:20},(_,i)=>key(i+1));
 const owners=['1nc1nerator11111111111111111111111111111111',...wallets];
 const accounts=owners.map((owner,i)=>({pubkey:key(i+50),account:{owner:token,executable:false,data:{parsed:{type:'account',info:{mint,owner,tokenAmount:{amount:String(100-i)}}}}}}));
 return {mint,observedAt:'2026-11-26T06:00:00Z',mintResponse:{context:{slot:10},value:{owner:token,executable:false,data:{parsed:{type:'mint',info:{supply:String(accounts.reduce((n,r)=>n+Number(r.account.data.parsed.info.tokenAmount.amount),0)),decimals:6}}}}},
  inventory:{context:{slot:11},value:accounts},ownerAddresses:owners,ownerResponse:{context:{slot:12},value:owners.map(()=>({owner:system,executable:false}))}};
}
test('canonical capture retains raw mapping, exclusions, aggregation and distinct slots',()=>{
 const input=fixture(),before=JSON.stringify(input),out=buildCanonicalHolderSnapshot(input);
 assert.equal(out.snapshot.eligibleHolders.length,20);assert.equal(out.snapshot.excludedWallets[0].reason,'INCINERATOR');
 assert.equal(out.snapshot.atomic,false);assert.deepEqual(out.snapshot.contextSlots,{inventory:11,mint:10,classifications:12});
 assert.match(out.snapshot.holderSetHash,/^[a-f0-9]{64}$/);assert.equal(out.snapshot.hashAlgorithm,'sha256-ordered-eligible-wallet-token-accounts-v2');
 assert.equal(buildCanonicalHolderSnapshot(input).snapshot.holderSetHash,out.snapshot.holderSetHash);
 assert.equal(JSON.stringify(input),before);assert.equal(out.snapshot.commonOwnershipEstablished,false);
});
test('wallet balances aggregate multiple accounts before ranking and hashing',()=>{
 const input=fixture(),copy=structuredClone(input.inventory.value[1]);copy.pubkey=key(90);copy.account.data.parsed.info.tokenAmount.amount='1';
 input.inventory.value.push(copy);input.mintResponse.value.data.parsed.info.supply=String(BigInt(input.mintResponse.value.data.parsed.info.supply)+1n);
 const out=buildCanonicalHolderSnapshot(input);assert.equal(out.snapshot.eligibleHolders[0].balance,'100');assert.equal(out.snapshot.eligibleHolders[0].tokenAccounts.length,2);
});
for(const [name,change] of [
 ['supply disagreement',i=>i.mintResponse.value.data.parsed.info.supply='1'],
 ['duplicate account',i=>i.inventory.value.push(i.inventory.value[0])],
 ['missing owner',i=>i.ownerResponse.value[2]=null],
 ['wrong mint',i=>i.inventory.value[1].account.data.parsed.info.mint=key(99)],
 ['unsafe raw balance',i=>i.inventory.value[1].account.data.parsed.info.tokenAmount.amount=1.1],
])test(`capture rejects ${name}`,()=>{const input=fixture();change(input);assert.throws(()=>buildCanonicalHolderSnapshot(input));});

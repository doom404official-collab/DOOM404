import test from 'node:test';
import assert from 'node:assert/strict';
import {Keypair,PublicKey} from '@solana/web3.js';
import {buildCanonicalHolderSnapshot,normalizeBinaryHolderInventory} from '../lib/canonicalHolderSnapshot.mjs';
const token='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',system='11111111111111111111111111111111';
const key=i=>Keypair.fromSeed(Uint8Array.from({length:32},(_,n)=>(i+n)%256)).publicKey.toBase58();
function fixture(){
 const mint=key(100),wallets=Array.from({length:20},(_,i)=>key(i+1));
 const owners=['1nc1nerator11111111111111111111111111111111',...wallets];
 const accounts=owners.map((owner,i)=>({pubkey:key(i+50),account:{owner:token,executable:false,data:{parsed:{type:'account',info:{mint,owner,tokenAmount:{amount:String(100-i)}}}}}}));
 return {mint,observedAt:'2026-11-26T06:00:00Z',mintResponse:{context:{slot:10},value:{owner:token,executable:false,data:{parsed:{type:'mint',info:{supply:String(accounts.reduce((n,r)=>n+Number(r.account.data.parsed.info.tokenAmount.amount),0)),decimals:6}}}}},
  inventory:{context:{slot:11},value:accounts},ownerAddresses:owners,ownerResponse:{context:{slot:12},value:owners.map(()=>({owner:system,executable:false}))}};
}
function binaryFixture(){const input=fixture();return {input,response:{context:input.inventory.context,value:input.inventory.value.map(r=>{
 const b=Buffer.alloc(166),info=r.account.data.parsed.info;Buffer.from(new PublicKey(input.mint).toBytes()).copy(b,0);
 Buffer.from(new PublicKey(info.owner).toBytes()).copy(b,32);b.writeBigUInt64LE(BigInt(info.tokenAmount.amount),64);b[108]=1;b[165]=2;
 return {pubkey:r.pubkey,account:{owner:token,executable:false,data:[b.toString('base64'),'base64']}};
})}};}
test('bounded binary account prefixes preserve canonical wallet ranking and hash',()=>{
 const {input,response}=binaryFixture(),parsed=buildCanonicalHolderSnapshot(input);
 input.inventory=normalizeBinaryHolderInventory({mint:input.mint,response});
 const binary=buildCanonicalHolderSnapshot(input);
 assert.equal(binary.snapshot.holderSetHash,parsed.snapshot.holderSetHash);
 assert.deepEqual(binary.snapshot.eligibleHolders.map(h=>[h.wallet,h.balance]),parsed.snapshot.eligibleHolders.map(h=>[h.wallet,h.balance]));
 assert.match(binary.inventory[0].tokenAccounts[0].prefixSha256,/^[a-f0-9]{64}$/);
});
test('binary inventory rejects wrong Token-2022 account type and missing state prefix',()=>{
 for(const mode of ['type','short']){const {input,response}=binaryFixture();let b=Buffer.from(response.value[0].account.data[0],'base64');
  if(mode==='type')b[165]=1;else b=b.subarray(0,72);response.value[0].account.data[0]=b.toString('base64');
  assert.throws(()=>normalizeBinaryHolderInventory({mint:input.mint,response}),/HOLDER_BINARY_ACCOUNT_INVALID/);
 }
});
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {extractHolderNetworkTransfers} from '../lib/holderNetworkTransfers.mjs';
import {observeCreatorSplTransfers} from '../lib/creatorSplTransferObservations.mjs';

const raw=readFileSync(new URL('./fixtures/transfer-witness-44272054942/projection.json',import.meta.url));
const p=JSON.parse(raw),keys=p.message.accountKeys;
const hash=b=>createHash('sha256').update(b).digest('hex');
function b58(s){
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;
 for(const c of s){assert.ok(alphabet.includes(c));n=n*58n+BigInt(alphabet.indexOf(c));}
 const bytes=[];while(n){bytes.unshift(Number(n&255n));n>>=8n;}
 return Buffer.from([...Array(s.length-s.replace(/^1+/,'').length).fill(0),...bytes]);
}
function short(n){const a=[];while(n>=128){a.push((n&127)|128);n>>=7;}return Buffer.from([...a,n]);}
function messageBytes(){
 const h=p.message.header;
 return Buffer.concat([Buffer.from([h.numRequiredSignatures,h.numReadonlySignedAccounts,h.numReadonlyUnsignedAccounts]),
 short(keys.length),...keys.map(b58),b58(p.message.recentBlockhash),short(p.message.instructions.length),
 ...p.message.instructions.flatMap(i=>{const d=b58(i.data);return [Buffer.from([i.programIdIndex]),short(i.accounts.length),Buffer.from(i.accounts),short(d.length),d];})]);
}
function checked(i){
 const d=b58(i.data);assert.equal(d.length,10);assert.equal(d[0],12);
 const [source,mint,destination,authority]=i.accounts.map(n=>keys[n]);
 return {program:'spl-token',programId:keys[i.programIdIndex],parsed:{type:'transferChecked',info:{
 source,mint,destination,authority,tokenAmount:{amount:d.readBigUInt64LE(1).toString(),decimals:d[9]}}}};
}
const target=p.innerInstructions[1].instructions[1];
const balances=rows=>rows.map(({amountRaw,decimals,...rest})=>({...rest,uiTokenAmount:{amount:amountRaw,decimals}}));

// Explicitly synthetic schema adaptation, not a recovered jsonParsed RPC response.
// Compiled instructions retain bytes/program/account identity; only TransferChecked
// instructions are decoded. Unknown lifecycle instructions must stay opaque.
function reconstructed(){
 const ix=i=>[28,29].includes(i.programIdIndex)&&b58(i.data)[0]===12?checked(i):
 {...i,programId:keys[i.programIdIndex],accounts:i.accounts.map(n=>keys[n])};
 return {slot:p.slot,version:p.version,transaction:{signatures:p.signatures,message:{
 ...p.message,instructions:p.message.instructions.map(ix)}},meta:{err:p.executionError,
 preTokenBalances:balances(p.preTokenBalances),postTokenBalances:balances(p.postTokenBalances),
 innerInstructions:p.innerInstructions.map(g=>({...g,instructions:g.instructions.map(ix)}))}};
}
test('retained public projection has exact digest and unchanged non-promoting flags',()=>{
 assert.equal(raw.length,7719);assert.equal(hash(raw),'6e54ec856837729bffeb25ac1acb1a346eaec044d830b534bee71cd674328942');
 for(const k of ['scorePromoted','settlementVerified','transferBehaviorVerified','signatureCryptographicallyVerified'])assert.equal(p[k],false);
 assert.equal(p.signature,p.signatures[0]);assert.equal(p.slot,450097547);
});
test('reconstructed legacy signed message verifies; mutation fails, metadata is excluded',()=>{
 assert.equal(p.version,'legacy');assert.deepEqual(p.loadedAddresses,{readonly:[],writable:[]});
 assert.equal(p.signatures.length,p.message.header.numRequiredSignatures);assert.equal(p.signatures.length,1);
 for(const k of keys)assert.equal(b58(k).length,32);
 const m=messageBytes();assert.equal(m.length,1154);
 assert.equal(hash(m),'a96d6d71dc6406f3cf7b500553dcda04bf4957d722025c3db471fdd6b6e9546d');
 const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),b58(keys[0])]),format:'der',type:'spki'});
 assert.equal(verify(null,m,key,b58(p.signature)),true);
 const bad=Buffer.from(m);bad[bad.length-1]^=1;assert.equal(verify(null,bad,key,b58(p.signature)),false);
});
test('all six reported persistent token balances reconcile to five decoded transfers',()=>{
 const moves=p.innerInstructions.flatMap(g=>g.instructions).filter(i=>[28,29].includes(i.programIdIndex)&&b58(i.data)[0]===12);
 assert.equal(moves.length,5);
 assert.deepEqual(p.preTokenBalances.map(b=>b.accountIndex),p.postTokenBalances.map(b=>b.accountIndex));
 for(const before of p.preTokenBalances){
 const after=p.postTokenBalances.find(b=>b.accountIndex===before.accountIndex);
 for(const key of ['mint','owner','decimals','programId'])assert.equal(before[key],after[key]);
 const delta=moves.reduce((sum,i)=>sum+b58(i.data).readBigUInt64LE(1)*(BigInt(i.accounts[2]===before.accountIndex)-BigInt(i.accounts[0]===before.accountIndex)),0n);
 assert.equal(BigInt(after.amountRaw)-BigInt(before.amountRaw),delta);
 }
 assert.equal(checked(target).parsed.info.tokenAmount.amount,'22632179539');
 assert.equal(moves.filter(i=>i.programIdIndex===28).reduce((s,i)=>s+b58(i.data).readBigUInt64LE(1),0n),2000000000n);
});
test('full reconstructed schema remains Unknown for opaque ownership, never bypasses lifecycle guards',()=>{
 const tx=reconstructed(),result=extractHolderNetworkTransfers({transaction:tx,signature:p.signature});
 assert.equal(result.valid,true);assert.equal(result.transfers.length,0);
 assert.ok(result.unresolvedReasons.OWNERSHIP_TIMELINE_UNVERIFIED>=1);
 const observed=observeCreatorSplTransfers({transaction:tx,signature:p.signature,mint:p.targetMint,creator:keys[0]});
 assert.equal(observed.length,1);assert.equal(observed[0].independentlyVerified,false);
 assert.equal(observed[0].classification,'UNVERIFIED_SPL_TRANSFER');
});
test('synthetic isolated parsed compatibility case accepts generic label with canonical Token-2022 ID',()=>{
 // Not an authentic full transaction: deliberately isolated parser contract case.
 const tx=reconstructed();tx.transaction.message.instructions=[checked(target)];tx.meta.innerInstructions=[];
 const result=extractHolderNetworkTransfers({transaction:tx,signature:p.signature});
 assert.equal(result.transfers.length,1);assert.equal(result.transfers[0].assetType,'TOKEN_2022');
 assert.equal(result.transfers[0].amountRaw,'22632179539');
 assert.equal(result.transfers[0].from,keys[3]);assert.equal(result.transfers[0].to,keys[0]);
 const foreign=structuredClone(tx);foreign.transaction.message.instructions[0].programId=keys[25];
 assert.equal(extractHolderNetworkTransfers({transaction:foreign,signature:p.signature}).transfers.length,0);
});
test('isolated compatibility cannot override missing, conflicting or changed transfer-time ownership',()=>{
 for(const change of [
 tx=>{tx.meta.preTokenBalances=[];},
 tx=>{tx.meta.postTokenBalances.find(b=>b.accountIndex===7).owner=keys[3];},
 tx=>{tx.transaction.message.instructions.push({programId:keys[29],program:'spl-token',parsed:{type:'setAuthority',info:{account:keys[7]}}});}
 ]){
 const tx=reconstructed();tx.transaction.message.instructions=[checked(target)];tx.meta.innerInstructions=[];change(tx);
 assert.equal(extractHolderNetworkTransfers({transaction:tx,signature:p.signature}).transfers.length,0);
 }
});

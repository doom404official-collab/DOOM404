import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewHolderCompiledInstruction as preview} from '../scripts/offline/preview-holder-compiled-instruction.mjs';
import {holderTransferContext} from '../lib/holderTransferContext.mjs';
import {validNetworkAddress} from '../lib/holderNetworkTransfers.mjs';
const p=JSON.parse(readFileSync(new URL('./fixtures/transfer-witness-44272054942/projection.json',import.meta.url)));
const keys=p.message.accountKeys,group=p.innerInstructions[0];
test('authentic compiled byte locations derive exact labeled candidates without execution promotion',()=>{
 const cases=[
 [p.message.instructions[4],'transfer'],
 [p.message.instructions[5],'syncNative'],
 [p.message.instructions[7],'closeAccount'],
 [group.instructions[0],'getAccountDataSize'],
 [group.instructions[1],'createAccount'],
 [group.instructions[2],'initializeImmutableOwner'],
 [group.instructions[3],'initializeAccount3'],
 [p.innerInstructions[1].instructions[1],'transferChecked']];
 for(const [ix,type] of cases){const r=preview(ix,keys);assert.equal(r.status,'DERIVED_CANDIDATE');assert.equal(r.candidate.parsed.type,type);assert.equal(r.executionVerified,false);}
 const creation=preview(group.instructions[1],keys).candidate.parsed.info;
 assert.deepEqual(creation,{source:keys[0],newAccount:keys[2],lamports:'1488440',space:'165',owner:keys[28]});
 assert.equal(preview(group.instructions[3],keys).candidate.parsed.info.owner,keys[0]);
 assert.equal(preview(p.innerInstructions[1].instructions[1],keys).candidate.parsed.info.tokenAmount.amount,'22632179539');
});
test('every unsupported instruction is retained in synthetic timeline, not silently discarded',()=>{
 const retained=[],unknown=[];
 function map(ix,location){
  const r=preview(ix,keys);retained.push(location);
  if(r.candidate)return r.candidate;
  unknown.push(location);
  return {...ix,programId:keys[ix.programIdIndex],accounts:ix.accounts.map(i=>keys[i])};
 }
 const instructions=p.message.instructions.map((i,n)=>map(i,`outer:${n}`));
 const innerInstructions=p.innerInstructions.map(g=>({...g,instructions:g.instructions.map((i,n)=>map(i,`inner:${g.index}:${n}`))}));
 assert.equal(retained.length,21);assert.equal(unknown.length,7);
 const tx={transaction:{message:{accountKeys:keys,instructions}},meta:{innerInstructions,
 preTokenBalances:p.preTokenBalances,postTokenBalances:p.postTokenBalances}};
 // Only review existing context semantics; do not invoke edge promotion or save.
 const c=holderTransferContext(tx,p.signature,validNetworkAddress);
 assert.equal(c.opaqueOwnership,false);assert.deepEqual([...c.conflicts],[keys[2]]);
 assert.equal(c.owners.has(keys[2]),false);
 for(const n of [7,9])assert.equal(c.owners.has(keys[n]),true);
 assert.ok(unknown.includes('outer:6')); // AMM is still unsupported, not "verified".
});
test('extra/truncated bytes, counts, indexes, programs and mixed representations fail closed',()=>{
 const ix=group.instructions[3];
 for(const bad of [
 {...ix,data:ix.data.slice(0,-1)},{...ix,data:'1'+ix.data},{...ix,data:'0'},
 {...ix,accounts:[]},{...ix,accounts:[2,27,0]},{...ix,accounts:[true,27]},
 {...ix,accounts:[2,256]},{...ix,programIdIndex:true},{...ix,programIdIndex:25},
 {...ix,parsed:{}},{...ix,programId:keys[28]},{...ix,data:'1'.repeat(73)}
 ])assert.equal(preview(bad,keys).status,'UNKNOWN');
 assert.equal(preview(ix,[...keys,keys[0]]).status,'UNKNOWN');
 const invalid=[...keys];invalid[0]='3'.repeat(32);
 assert.equal(preview(ix,invalid).status,'UNKNOWN');
});
test('unsupported known-program opcode stays opaque and original bytes remain immutable',()=>{
 const frozen=JSON.stringify(p);
 const bad={programIdIndex:28,accounts:[2],data:'Q'};
 const r=preview(bad,keys);assert.equal(r.status,'UNKNOWN');assert.equal(r.candidate,null);
 const c=holderTransferContext({transaction:{message:{accountKeys:keys,instructions:[{...bad,programId:keys[28]}]}},
 meta:{innerInstructions:[],preTokenBalances:p.preTokenBalances,postTokenBalances:p.postTokenBalances}},p.signature,validNetworkAddress);
 assert.equal(c.opaqueOwnership,true);assert.equal(JSON.stringify(p),frozen);
});

test('sparse and inherited-index arrays stay UNKNOWN for keys and instruction accounts',()=>{
 const ix=group.instructions[3];
 for(const index of [0,2,28,keys.length-1]){
  const sparse=keys.slice();delete sparse[index];
  assert.equal(preview(ix,sparse).status,'UNKNOWN');
  const inherited=keys.slice();delete inherited[index];
  Object.setPrototypeOf(inherited,Object.assign(Object.create(Array.prototype),{[index]:keys[index]}));
  assert.equal(preview(ix,inherited).status,'UNKNOWN');
 }
 for(const accounts of [new Array(2),[2,,],[,27]]){
  assert.equal(preview({...ix,accounts},keys).status,'UNKNOWN');
 }
 const inherited=[2,27];delete inherited[0];
 Object.setPrototypeOf(inherited,Object.assign(Object.create(Array.prototype),{0:2}));
 assert.equal(preview({...ix,accounts:inherited},keys).status,'UNKNOWN');
});

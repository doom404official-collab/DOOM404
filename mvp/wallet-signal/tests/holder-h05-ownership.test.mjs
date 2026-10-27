import test from 'node:test';
import assert from 'node:assert/strict';
import {extractHolderNetworkTransfers as decode} from '../lib/holderNetworkTransfers.mjs';
import {extractDirectHolderTransfers as direct} from '../lib/directHolderTransfers.mjs';
import {scoreTop20Network} from '../lib/top20NetworkScore.mjs';
import {recordHolderNetworkTransaction} from '../lib/holderNetworkCheckpoint.mjs';
import {validateHolderEvidence} from '../lib/holderEvidenceValidator.mjs';
import {processEvidenceBatch} from '../lib/holderEvidenceBatch.mjs';
const A='3'.repeat(32),B='4'.repeat(32),C='5'.repeat(32),TA='6'.repeat(32),TB='7'.repeat(32),mint='8'.repeat(32),signature='2'.repeat(64);
const token='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',system='11111111111111111111111111111111';
const transfer={programId:token,parsed:{type:'transfer',info:{source:TA,destination:TB,amount:'10'}}};
const sol=(source,destination)=>({programId:system,program:'system',parsed:{type:'transfer',info:{source,destination,lamports:1}}});
function fixture(){const balances=[{accountIndex:0,owner:A,mint,programId:token},{accountIndex:1,owner:B,mint,programId:token}];return {slot:10,meta:{err:null,preTokenBalances:balances,postTokenBalances:structuredClone(balances),innerInstructions:[]},transaction:{signatures:[signature],message:{accountKeys:[TA,TB],instructions:[structuredClone(transfer)]}}};}
const extract=transaction=>decode({transaction,signature});
const holders=[{wallet:A,sharePct:1},{wallet:B,sharePct:1}];
test('stable transaction-local ownership overrides contradictory current snapshot mappings',()=>{
 const t=fixture(),before=JSON.stringify(t),r=extract(t);
 assert.equal(r.transfers[0].from,A);assert.equal(r.transfers[0].ownershipSource,'transaction_pre_post_stable');
 assert.equal(direct({transaction:t,signature,holderWallets:[A,B],tokenAccounts:[{tokenAccount:TA,ownerWallet:C}]}).length,1);
 assert.equal(JSON.stringify(t),before);
});
for(const side of ['preTokenBalances','postTokenBalances'])test(`one-sided ${side} never proves ownership`,()=>{
 const t=fixture();delete t.meta[side];assert.equal(extract(t).transfers.length,0);assert.equal(extract(t).unresolvedTokenTransfers,1);
});
for(const type of ['initializeAccount','initializeAccount2','initializeAccount3','closeAccount','setAuthority','reallocate'])test(`${type} anywhere in transaction withholds transfer-time ownership`,()=>{
 for(const before of [true,false]){
  const t=fixture(),ix={programId:token,parsed:{type,info:{account:TA,authorityType:'accountOwner',newAuthority:C,destination:B}}};
  t.transaction.message.instructions=before?[ix,transfer]:[transfer,ix];
  assert.equal(extract(t).transfers.length,0);assert.equal(extract(t).unresolvedReasons.OWNER_CONFLICT,1);
 }
});
for(const type of ['createAccount','assign','allocate'])test(`system ${type} cannot establish account owner`,()=>{
 const t=fixture();t.transaction.message.instructions.unshift({programId:system,parsed:{type,info:{account:TA,newAccount:TA,source:A}}});
 assert.equal(extract(t).transfers.length,0);
});
test('opaque token instructions and unknown extensions prevent stable-endpoint attribution',()=>{
 for(const ix of [{programId:token,data:'raw'},{programId:token,parsed:{type:'unknownExtension',info:{}}}]){
  const t=fixture();t.transaction.message.instructions.push(ix);assert.equal(extract(t).transfers.length,0);
 }
});
test('owner, mint, program and duplicate metadata conflicts remain Unknown',()=>{
 for(const change of [t=>t.meta.postTokenBalances[0].owner=C,t=>t.meta.postTokenBalances[0].mint=C,
  t=>t.meta.preTokenBalances.push({...t.meta.preTokenBalances[0]}),t=>t.meta.postTokenBalances[0].programId=system,
  t=>t.meta.preTokenBalances[0].owner=null]){
  const t=fixture();change(t);assert.equal(extract(t).transfers.length,0);
 }
});
test('outer/inner instruction locations persist in actual group order and equal-value events stay distinct',()=>{
 const t=fixture();t.transaction.message.instructions=[transfer,transfer];
 t.meta.innerInstructions=[{index:1,instructions:[transfer]},{index:0,instructions:[transfer,transfer]}];
 const r=extract(t);assert.equal(r.transfers.length,5);
 assert.deepEqual(r.transfers.map(e=>[e.outerInstructionIndex,e.innerInstructionIndex]),[[0,null],[0,0],[0,1],[1,null],[1,0]]);
 assert.equal(new Set(r.transfers.map(e=>e.instructionId)).size,5);
 assert.deepEqual(extract(JSON.parse(JSON.stringify(t))),r);
 const pairs=direct({transaction:t,signature,holderWallets:[A,B]});assert.equal(pairs.length,1);assert.equal(pairs[0].instructionIds.length,5);
 assert.deepEqual(scoreTop20Network({holders,transfers:r.transfers}),scoreTop20Network({holders,transfers:[r.transfers[0]]}));
});
test('missing, repeated and out-of-range inner group positions fail closed',()=>{
 for(const groups of [[{instructions:[transfer]}],[{index:-1,instructions:[]}],[{index:1,instructions:[]}],[{index:0,instructions:[]},{index:0,instructions:[]}]]){
  const t=fixture();t.meta.innerInstructions=groups;assert.equal(extract(t).valid,false);
 }
});
test('inner lifecycle change taints matching outer transfer regardless of group array order',()=>{
 const t=fixture();t.meta.innerInstructions=[{index:0,instructions:[{programId:token,parsed:{type:'closeAccount',info:{account:TA,destination:B}}}]}];
 assert.equal(extract(t).transfers.length,0);
});
test('intermediary path is not a direct pair, repeated instructions are not repeated signatures',()=>{
 const t=fixture();t.transaction.message.instructions=[sol(A,C),sol(C,B)];const r=extract(t);
 assert.deepEqual(direct({transaction:t,signature,holderWallets:[A,B]}),[]);
 const score=scoreTop20Network({holders,transfers:r.transfers});assert.equal(score.evidence.directPairs,0);assert.equal(score.evidence.indirectHolders,2);assert.equal(score.commonOwnershipEstablished,false);
 t.transaction.message.instructions=[sol(A,B),sol(A,B),sol(A,B)];const edges=extract(t).transfers;
 assert.equal(scoreTop20Network({holders,transfers:edges}).evidence.repeatedPairs,0);
 const distinct=[...edges,...['3','4'].map(c=>({...edges[0],signature:c.repeat(64)}))];
 assert.equal(scoreTop20Network({holders,transfers:distinct}).evidence.repeatedPairs,1);
});
test('recording duplicate response is idempotent and retained legacy history is untouched',()=>{
 const c={mint,holders:[{ownerWallet:A,sharePct:1},{ownerWallet:B,sharePct:1}],wallets:{},signatures:{[signature]:'checked'},edges:{}};
 recordHolderNetworkTransaction(c,{transaction:fixture(),signature});const saved=JSON.stringify(c);
 recordHolderNetworkTransaction(c,{transaction:fixture(),signature});assert.equal(JSON.stringify(c),saved);
 const legacy=JSON.parse(saved);delete legacy.networkEvidence.transfers[0].instructionId;
 const old=JSON.stringify(legacy);recordHolderNetworkTransaction(legacy,{transaction:fixture(),signature});assert.equal(JSON.stringify(legacy),old);
});
test('unresolved historical ownership remains unavailable in both evidence validators',async()=>{
 const t=fixture();delete t.meta.preTokenBalances;
 const checkpoint={wallets:{[A]:{},[B]:{}},holders:[],edges:{[A+'|'+B]:{walletA:A,walletB:B,signatures:[signature]}}};
 const r=await validateHolderEvidence({checkpoint,rpc:async()=>t});assert.equal(r.results[0].status,'unverified');assert.equal(r.complete,false);
 let saved;await processEvidenceBatch({jobId:'offline',checkpoint,rpc:async()=>t,store:{seed:async()=>1,claim:async()=>[{signature,attempts:0}],finish:async(_j,_s,_w,result)=>{saved=result;return true;}}});
 assert.equal(saved.status,'unavailable');assert.equal(saved.evidence.networkExtraction.unresolvedTokenTransfers,1);
});

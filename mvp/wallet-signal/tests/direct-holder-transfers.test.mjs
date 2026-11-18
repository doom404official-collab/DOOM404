import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDirectHolderTransfers} from '../lib/directHolderTransfers.mjs';
const A='3'.repeat(32),B='4'.repeat(32),signature='2'.repeat(64);
const wrap=(instructions,err=null)=>({slot:100,meta:{err,innerInstructions:[]},transaction:{signatures:[signature],message:{accountKeys:[],instructions}}});
const sol={programId:'11111111111111111111111111111111',program:'system',parsed:{type:'transfer',info:{source:A,destination:B,lamports:1}}};
const extract=transaction=>extractDirectHolderTransfers({transaction,signature,holderWallets:[A,B]});
test('one direct SOL transfer creates an edge',()=>{assert.equal(extract(wrap([sol]))[0].directInteraction,true);});
test('co-occurrence is not a transfer',()=>{assert.deepEqual(extract(wrap([{...sol,parsed:{type:'createAccount',info:{source:A,newAccount:B}}}])),[]);});
test('failed and mismatched transactions do not create connections',()=>{
 assert.deepEqual(extract(wrap([sol],{InstructionError:[0,'Custom']})),[]);
 const t=wrap([sol]);t.transaction.signatures=['5'.repeat(64)];assert.deepEqual(extract(t),[]);
});
test('snapshot token-account owners cannot substitute for historical owners',()=>{
 const t=wrap([{programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',parsed:{type:'transfer',info:{source:A,destination:B,amount:'10'}}}]);
 assert.deepEqual(extractDirectHolderTransfers({transaction:t,signature,holderWallets:[A,B],tokenAccounts:[{tokenAccount:A,ownerWallet:A},{tokenAccount:B,ownerWallet:B}]}),[]);
});

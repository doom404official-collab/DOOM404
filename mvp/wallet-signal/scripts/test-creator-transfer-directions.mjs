import assert from 'node:assert/strict';
import {classifyCreatorTransferDirections} from '../lib/creatorTransferDirectionClassifier.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const tx={transaction:{message:{accountKeys:['outside','creator-ata'],instructions:[{program:'spl-token',parsed:{
 type:'transferChecked',info:{source:'outside',destination:'creator-ata',mint,tokenAmount:{amount:'100'}}}}]}},
 meta:{err:null,preTokenBalances:[{accountIndex:0,mint,owner:'other',uiTokenAmount:{amount:'200'}},
 {accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'0'}}],
 postTokenBalances:[{accountIndex:0,mint,owner:'other',uiTokenAmount:{amount:'100'}},
 {accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'100'}}]}};
const result=classifyCreatorTransferDirections({mint,creator,signature:'sig',transaction:tx});
assert.equal(result[0].type,'EXTERNAL_RECEIPT_CANDIDATE');
assert.equal(result[0].ledgerEligible,false);
const unknown={...tx,meta:{...tx.meta,preTokenBalances:[]}};
assert.equal(classifyCreatorTransferDirections({mint,creator,signature:'sig',transaction:unknown})[0].type,'EXTERNAL_RECEIPT_CANDIDATE');
console.log('creator transfer direction classification tests passed');

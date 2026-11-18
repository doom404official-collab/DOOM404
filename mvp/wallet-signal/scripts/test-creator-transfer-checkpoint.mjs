import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../tests/helpers/creatorTickMockLease.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const signature='2'.repeat(88);
let state={originEvidence:[{creator,signature:'1'.repeat(88)}],creatorHistorySignatures:[signature]};
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?{
  blockTime:1700000000,transaction:{message:{accountKeys:['external-ata','creator-ata'],
  instructions:[{program:'spl-token',parsed:{type:'transferChecked',info:{
   source:'external-ata',destination:'creator-ata',mint,tokenAmount:{amount:'100'}}}}]}},
  meta:{err:null,preTokenBalances:[{accountIndex:0,mint,owner:'external',uiTokenAmount:{amount:'200'}},
   {accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'0'}}],
  postTokenBalances:[{accountIndex:0,mint,owner:'external',uiTokenAmount:{amount:'100'}},
   {accountIndex:1,mint,owner:creator,uiTokenAmount:{amount:'100'}}]}}:[]})};
};
for(let i=0;i<2;i++){
 await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
 assert.equal(state.creatorTransferDirections.length,1);
 assert.equal(state.creatorTransferDirections[0].type,'EXTERNAL_RECEIPT_CANDIDATE');
 assert.equal(state.creatorTransferDirections[0].ledgerEligible,false);
}
console.log('creator transfer direction checkpoint persistence tests passed');

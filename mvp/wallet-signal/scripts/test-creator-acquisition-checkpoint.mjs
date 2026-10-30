import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../tests/helpers/creatorTickMockLease.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const sig='2'.repeat(88);
let state={originEvidence:[{creator,signature:'1'.repeat(88)}],creatorHistorySignatures:[sig]};
const store={async get(){return {stage:'selling',status:'partial',state}},async claim(){return true},async save(v){state=v.state}};
const fetchImpl=async(_url,options)=>{
 const {method}=JSON.parse(options.body);
 return {ok:true,status:200,json:async()=>({result:method==='getTransaction'?{
  blockTime:1700000000,transaction:{message:{accountKeys:['creator-ata'],instructions:[]}},
  meta:{err:null,preTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'100'}}],
  postTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'150'}}]}}:[]})};
};
for(let i=0;i<2;i++){
 await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
 assert.equal(state.creatorAcquisitionMovements.length,1);
 assert.equal(state.creatorAcquisitionMovements[0].classification,'UNCLASSIFIED_BALANCE_MOVEMENT');
 assert.equal(state.creatorAcquisitionMovements[0].independentlyVerified,false);
}
console.log('creator acquisition movement checkpoint persistence tests passed');

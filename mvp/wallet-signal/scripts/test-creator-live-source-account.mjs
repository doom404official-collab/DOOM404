import assert from 'node:assert/strict';
import {verifyLiveCreatorSourceAccount} from '../lib/creatorLiveSourceAccount.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
let calls=0;
const result=await verifyLiveCreatorSourceAccount({mint,creator,tokenAccount:'source-ata',rpc:{
 getParsedAccountInfo:async()=>{calls++;return {value:{data:{parsed:{type:'account',info:{mint,owner:creator}}}}};}
}});
assert.equal(calls,1);
assert.equal(result.currentOwnershipVerified,true);
assert.equal(result.historicalOwnershipVerified,false);
console.log('creator live source account tests passed');

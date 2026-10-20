import assert from 'node:assert/strict';
import {corroborateCreatorSellFlows} from '../lib/creatorSellFlowCorroboration.mjs';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const transaction={transaction:{message:{accountKeys:[{pubkey:creator,signer:true}]}},meta:{
 err:null,preTokenBalances:[{mint,owner:creator,uiTokenAmount:{amount:'1000'}}],
 postTokenBalances:[{mint,owner:creator,uiTokenAmount:{amount:'800'}}],
 preBalances:[1000000],postBalances:[1100000]}};
const result=corroborateCreatorSellFlows({transaction,creator,mint,claimedSoldRaw:'200'});
assert.equal(result.status,'FLOW_OBSERVED');
assert.equal(result.saleVerified,false);
assert.equal(result.netSolLamports,100000);
assert.equal(corroborateCreatorSellFlows({transaction:{...transaction,transaction:{message:{accountKeys:[{pubkey:creator,signer:false}]}}},creator,mint,claimedSoldRaw:'200'}).reason,'CREATOR_NOT_SIGNER');
console.log('creator sell flow corroboration tests passed');

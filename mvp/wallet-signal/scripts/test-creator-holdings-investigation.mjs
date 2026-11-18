import assert from 'node:assert/strict';
import { investigateCreatorHoldings } from '../lib/creatorHoldingsInvestigation.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const result=await investigateCreatorHoldings({mint,creator,rpc:{
 getTokenSupply:async()=>({value:{amount:'1000000',decimals:2}}),
 getTokenAccountsByOwner:async()=>({value:[{pubkey:mint,account:{data:{parsed:{type:'account',info:{mint,owner:creator,tokenAmount:{amount:'20000'}}}}}}]})
}});
assert.equal(result.rawBalance,'20000');
assert.equal(result.supplySharePct,2);
assert.equal(result.holdingsScoreEligible,false);
assert.equal(result.historicalSalesAssessed,false);
assert.equal(result.linkedWalletsAssessed,false);
console.log('creator holdings investigation tests passed');

import assert from 'node:assert/strict';
import {verifyHistoricalCreatorSourceAccount} from '../lib/creatorHistoricalSourceOwnership.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const tx={transaction:{message:{accountKeys:['source-ata']}},meta:{err:null,
 preTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'100'}}],
 postTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'0'}}]}};
assert.equal(verifyHistoricalCreatorSourceAccount({transaction:tx,mint,creator,tokenAccount:'source-ata'}).historicalOwnershipVerified,true);
const wrong={...tx,meta:{...tx.meta,preTokenBalances:[{accountIndex:0,mint,owner:'other'}]}};
assert.equal(verifyHistoricalCreatorSourceAccount({transaction:wrong,mint,creator,tokenAccount:'source-ata'}).status,'UNVERIFIED');
console.log('creator historical source ownership tests passed');

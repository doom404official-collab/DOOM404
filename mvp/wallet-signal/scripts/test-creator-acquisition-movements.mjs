import assert from 'node:assert/strict';
import {observeCreatorAcquisitionMovements} from '../lib/creatorAcquisitionMovements.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const transaction={transaction:{message:{accountKeys:['creator-token']}},meta:{err:null,
 preTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'100'}}],
 postTokenBalances:[{accountIndex:0,mint,owner:creator,uiTokenAmount:{amount:'150'}}]}};
const observed=observeCreatorAcquisitionMovements({mint,creator,signature:'sig1',transaction});
assert.equal(observed.movements.length,1);
assert.equal(observed.movements[0].direction,'IN');
assert.equal(observed.movements[0].amountRaw,'50');
assert.equal(observed.movements[0].independentlyVerified,false);
const missing=observeCreatorAcquisitionMovements({mint,creator,signature:'sig1',
 transaction:{...transaction,meta:{...transaction.meta,postTokenBalances:[]}}});
assert.equal(missing.acquisitionVerified,false);
console.log('creator acquisition movement observations passed');

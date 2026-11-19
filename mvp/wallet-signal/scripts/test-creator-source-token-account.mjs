import assert from 'node:assert/strict';
import {verifyCreatorSourceTokenAccount} from '../lib/creatorSourceTokenAccount.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const accountInfo={value:{data:{parsed:{type:'account',info:{mint,owner:creator}}}}};
const result=verifyCreatorSourceTokenAccount({mint,creator,tokenAccount:'source-ata',accountInfo});
assert.equal(result.currentOwnershipVerified,true);
assert.equal(result.historicalOwnershipVerified,false);
assert.equal(verifyCreatorSourceTokenAccount({mint,creator,tokenAccount:'source-ata',
 accountInfo:{value:{data:{parsed:{type:'account',info:{mint,owner:'other'}}}}}}).status,'UNVERIFIED');
console.log('creator source token account tests passed');

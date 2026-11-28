import assert from 'node:assert/strict';
import { verifyLaunchpadCreation } from '../lib/launchpadCreationVerifier.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const programId='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const signature='1'.repeat(88);
const transaction={meta:{err:null,preTokenBalances:[],postTokenBalances:[],innerInstructions:[]},
 transaction:{message:{accountKeys:[],instructions:[{programId,data:'verified-creation-instruction'}]}}};
const decoder=()=>({verified:true,mint,role:'launchpad_creator',creator,decoderVersion:'fixture-v1',creationInstructionVerified:true});
const proof=verifyLaunchpadCreation({mint,signature,transaction,decoders:{[programId]:decoder}});
assert.equal(proof.status,'VERIFIED');
assert.equal(proof.decodedRoles[0].address,creator);
assert.equal(transaction.meta.preTokenBalances.length,0);
assert.equal(transaction.meta.postTokenBalances.length,0);
const rejected=verifyLaunchpadCreation({mint,signature,transaction,decoders:{[programId]:()=>({...decoder(),mint:'different'})}});
assert.equal(rejected.status,'UNRESOLVED');
console.log('creator zero-purchase identification tests passed');

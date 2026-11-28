import assert from 'node:assert/strict';
import {identifyCreatorSolTransferCandidates} from '../lib/creatorPoolSolTransfers.mjs';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const pool='pool-address';
const tx={transaction:{message:{instructions:[]}},meta:{err:null,innerInstructions:[{instructions:[
 {program:'system',parsed:{type:'transfer',info:{source:pool,destination:creator,lamports:100000}}}
]}]}};
const transfers=identifyCreatorSolTransferCandidates({transaction:tx,creator,pool});
assert.equal(transfers.length,1);
assert.equal(transfers[0].lamports,100000);
assert.equal(transfers[0].settlementVerified,false);
assert.equal(identifyCreatorSolTransferCandidates({transaction:tx,creator,pool:'wrong'}).length,0);
console.log('creator pool SOL transfer candidate tests passed');

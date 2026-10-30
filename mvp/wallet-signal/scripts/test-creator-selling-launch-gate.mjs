import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../tests/helpers/creatorTickMockLease.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
let saved;
const state={originEvidence:[{creator,signature:'1'.repeat(88)}],launchTimestamp:1700000000,
 creatorHistorySignatures:[],initialAttributableRaw:null};
const store={async get(){return {status:'partial',stage:'selling',state}},async claim(){return true},async save(v){saved=v}};
const fetchImpl=async()=>({ok:true,status:200,json:async()=>({result:[]})});
const result=await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl});
assert.equal(result.stage,'selling');
assert.equal(saved.state.launchTimestamp,1700000000);
assert.equal(saved.state.sellingStatus,'AWAITING_VERIFIED_INITIAL_ALLOCATION');
assert.equal(saved.state.selling,undefined);
assert.equal(saved.state.initialAllocationEvidence.initialAttributableRaw,null);
assert.equal(saved.state.verifiedSwapSales.length,0);
console.log('creator selling launch-time allocation gate tests passed');

import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverSolRelationships} from './historicalSolRelationships.mjs';
test('missing RPC and wallet are rejected before network calls',async()=>{
 await assert.rejects(()=>discoverSolRelationships({wallet:'11111111111111111111111111111111'}),TypeError);
 await assert.rejects(()=>discoverSolRelationships({rpcUrl:'https://example.com'}),TypeError);
});
test('unsafe history limits are rejected',async()=>{
 await assert.rejects(()=>discoverSolRelationships({rpcUrl:'https://example.com',wallet:'11111111111111111111111111111111',limit:1001}),TypeError);
});

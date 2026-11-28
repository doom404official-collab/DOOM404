import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {verifySignedBurnInstructionV2} from '../lib/creatorSignedBurnProofV2.mjs';
const tx=JSON.parse(fs.readFileSync(new URL('./fixtures/creator-observed-behaviour-v2.json',import.meta.url))).targetedTransactions[0];
test('retained creator burn instruction verifies against the original Ed25519 signature',()=>assert.equal(verifySignedBurnInstructionV2(tx),true));
test('changing an amount, authority, blockhash or signature breaks independent authentication',()=>{
 for(const change of [x=>x.transaction.message.instructions[2].parsed.info.tokenAmount.amount='1',x=>x.transaction.message.recentBlockhash='11111111111111111111111111111111',x=>x.transaction.message.instructions[2].parsed.info.authority=x.transaction.message.instructions[2].parsed.info.mint,x=>x.transaction.signatures[0]='1'.repeat(64)]){const t=structuredClone(tx);change(t);assert.equal(verifySignedBurnInstructionV2(t),false);}
});

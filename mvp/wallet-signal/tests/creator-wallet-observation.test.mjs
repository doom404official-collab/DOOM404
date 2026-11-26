import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectCreatorWalletObservation} from '../lib/creatorWalletObservation.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/creator-wallet-474052934.json',import.meta.url)));
test('retained wallet inventory proves only its observed balance',()=>{
 const p=projectCreatorWalletObservation(f,f.mint,f.creator);
 assert.equal(p.rawBalance,'599036011328');assert.equal(p.accountCount,1);assert.equal(p.slot,474052934);assert.equal(p.scoreEligible,false);assert.equal(p.linkedWalletsAssessed,false);
});
test('foreign owners, duplicate accounts and malformed data never certify holdings',()=>{
 assert.equal(projectCreatorWalletObservation(f,f.mint,f.mint),null);
 for(const change of [x=>x.response.value.push(x.response.value[0]),x=>x.response.value[0].account.owner=f.mint,x=>x.response.value[0].account.space=1]){const x=structuredClone(f);change(x);assert.equal(projectCreatorWalletObservation(x,f.mint,f.creator),null);}
});

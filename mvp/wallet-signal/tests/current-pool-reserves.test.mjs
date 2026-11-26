import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectCurrentPoolReserves} from '../lib/currentPoolReserves.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/current-pool-reserves-474050889.json',import.meta.url)));
const mint=f.addresses[3];
test('same-slot reserves are re-derived without liquidity safety promotion',()=>{
 const p=projectCurrentPoolReserves(f,mint);
 assert.equal(p.baseReserveRaw,'93047913154088');assert.equal(p.quoteReserveRaw,'1306227668815');assert.equal(p.slot,474050889);assert.equal(p.atomic,true);
 assert.equal(p.executableDepthVerified,false);assert.equal(p.lpSecurityVerified,false);
 assert.equal(p.lpSupplyRaw,'152863668');assert.equal(p.flags.length,1);
});
test('foreign mint, mismatched references, owner, vault authority, truncated and frozen vaults fail closed',()=>{
 assert.equal(projectCurrentPoolReserves(f,f.addresses[5]),null);
 for(const mutate of [x=>x.addresses.reverse(),x=>x.response.value[0].owner=x.addresses[3],x=>x.response.value[1].space=165,x=>x.response.value[1].executable=true,x=>{const b=Buffer.from(x.response.value[1].data[0],'base64');b[108]=2;x.response.value[1].data[0]=b.toString('base64');},x=>{const b=Buffer.from(x.response.value[1].data[0],'base64');b[32]^=1;x.response.value[1].data[0]=b.toString('base64');}]){
  const x=structuredClone(f);mutate(x);assert.equal(projectCurrentPoolReserves(x,mint),null);
 }
});

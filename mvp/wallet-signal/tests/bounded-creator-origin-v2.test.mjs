import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {verifyBoundedCreatorOrigin} from '../lib/boundedCreatorOriginV2.mjs';
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/creator-launch-447328096.json',import.meta.url))),mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
test('known creation proves protocol role with mint birth, not off-chain identity',()=>{
 const p=verifyBoundedCreatorOrigin(f.transaction,mint);assert.ok(p);assert.equal(p.creator,'6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC');assert.equal(p.independentlyReviewed,false);assert.equal(p.creationSlot,447328096);
});
test('mint reuse, failed execution and absent signer cannot become creator attribution',()=>{
 const tx=structuredClone(f.transaction);tx.meta.err={InstructionError:[0,'InvalidArgument']};assert.equal(verifyBoundedCreatorOrigin(tx,mint),null);
 const changed=structuredClone(f.transaction);const i=changed.transaction.message.accountKeys.findIndex(k=>k.pubkey===mint);changed.meta.preBalances[i]=1;assert.equal(verifyBoundedCreatorOrigin(changed,mint),null);
 assert.equal(verifyBoundedCreatorOrigin(f.transaction,'So11111111111111111111111111111111111111112'),null);
});

test('versioned indexed JSON must retain explicit supported transaction semantics',()=>{
 const v1=structuredClone(f.transaction);v1.version=1;assert.ok(verifyBoundedCreatorOrigin(v1,mint));v1.version=2;assert.equal(verifyBoundedCreatorOrigin(v1,mint),null);
});

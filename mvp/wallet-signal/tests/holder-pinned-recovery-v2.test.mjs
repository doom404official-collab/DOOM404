import test from 'node:test';
import assert from 'node:assert/strict';
import {runPinnedHolderRecoveryV2} from '../lib/holderPinnedRecoveryV2.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const jobId='d07c0256-b472-4089-a237-99ed5e5c8cc4';
const now=new Date('2026-10-27T04:00:00Z');
const job=()=>({id:jobId,mint,version:1812,status:'running',lease_owner:null,lease_expires_at:null,checkpoint:{mint,holders:Array(20).fill({}),archiveCompletenessProven:false}});
function store(claimResult){return {getById:async()=>job(),claim:async()=>claimResult,renew:async()=>{throw Error('unexpected renew')},commit:async()=>{throw Error('unexpected commit')}}}
const args=s=>({store:s,rpc:async()=>{throw Error('unexpected RPC')},jobId,mint,expectedVersion:1812,now});
test('claim failure returns already claimed without RPC',async()=>assert.equal((await runPinnedHolderRecoveryV2(args(store(null)))).status,'ALREADY_CLAIMED'));
test('stale claim version rejected before RPC',async()=>assert.rejects(()=>runPinnedHolderRecoveryV2(args(store({...job(),version:1812}))),/CLAIM_VERSION/));
test('unexpected claim identity rejected before RPC',async()=>assert.rejects(()=>runPinnedHolderRecoveryV2(args(store({...job(),id:'c670f393-31b0-470c-a01f-cb2b813a1219',version:1813}))),/CLAIM_VERSION/));
test('valid claimed version reaches scan (RPC remains mocked)',async()=>assert.rejects(()=>runPinnedHolderRecoveryV2(args(store({...job(),version:1813}))),e=>!/CLAIM_VERSION/.test(e.message)));
test('budget over 20 rejected',async()=>assert.rejects(()=>runPinnedHolderRecoveryV2({...args(store(null)),maxRequests:21}),/BUDGET/));

import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {reconcileLiquidityLq09} from '../lib/liquidityLq09Reconciliation.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/lq09-458811200.json',import.meta.url)));
test('retained two-account historical evidence resolves amounts and exposes creator recipient mismatch without safety promotion',()=>{const p=reconcileLiquidityLq09(structuredClone(fixture));assert.equal(p.historicalAccountReads,2);assert.equal(p.amounts.totalTransferRaw,'2603773');assert.equal(p.amounts.unexplainedRaw,'0');assert.equal(p.creatorRecipientMatchesHistoricalState,false);assert.equal(p.protocolRecipientMatchesHistoricalState,true);assert.equal(p.authorizationVerified,false);assert.equal(p.withdrawalConfirmed,false);assert.equal(p.scoreEligible,false);});
for(const [name,mutate] of [
 ['current state substituted',a=>a.records[0].contextSlot++],
 ['raw bytes changed',a=>a.records[0].account.data[0]='AA=='],
 ['foreign token mint',a=>a.transaction.meta.preTokenBalances[0].mint='11111111111111111111111111111111'],
 ['recipient ownership changed',a=>{const k=a.transaction.transaction.message.accountKeys.map(k=>k.pubkey);const b=a.transaction.meta.postTokenBalances.find(b=>k[b.accountIndex]==='EFikfamGR5RwvVXWAgekcpcNEZnccmgAQjWASYnNSzG');b.owner='11111111111111111111111111111111';}],
 ['wrong signature',a=>a.transaction.transaction.signatures[0]='1'.repeat(88)],
 ['duplicate historical account',a=>a.records[1]=structuredClone(a.records[0])],
 ['unreconciled fee amount',a=>a.transaction.meta.innerInstructions[0].instructions[0].parsed.info.tokenAmount.amount='104153']
])test('rejects '+name,()=>{const a=structuredClone(fixture);mutate(a);assert.throws(()=>reconcileLiquidityLq09(a));});

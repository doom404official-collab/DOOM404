import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {projectCanonicalHolderObservation} from '../lib/canonicalHolderObservation.mjs';import {readDashboardEvidence,projectCreatorCheckpoint} from '../lib/dashboardEvidenceBridge.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/canonical-holder-474029636.json',import.meta.url))),mint=fixture.mint;
const row=()=>structuredClone(fixture);
test('retained baseline revalidates through jsonb key reordering and projects only public observations',()=>{const reorder=x=>Array.isArray(x)?x.map(reorder):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,reorder(x[k])])):x;const result=projectCanonicalHolderObservation(reorder(row()),mint);assert.equal(result.top20SharePct,24.5379);assert.equal(result.scoreEligible,false);assert.equal(result.atomic,false);assert.equal('canonicalCheckpoint' in result,false);});
for(const [name,mutate] of [
 ['balance rewrite',r=>{r.observation.eligibleHolders[0].balance='1';r.holder_ranking[0].balance='1';}],
 ['missing account mapping',r=>r.observation.eligibleHolders[0].tokenAccounts=[]],
 ['excluded authority rewrite',r=>r.observation.excludedWallets[0].reason='CUSTODIAN'],
 ['mixed snapshot slot',r=>r.observation.contextSlots.mint++],
 ['legacy snapshot identity',r=>r.id='1'.repeat(64)],
 ['invented completeness',r=>r.observation.historyComplete=true]
])test('rejects '+name,()=>{const r=row();mutate(r);assert.throws(()=>projectCanonicalHolderObservation(r,mint));});
test('canonical source failure preserves creator and liquidity reads without exposing internal state',async()=>{let requests=0;const r=await readDashboardEvidence({mint,url:'https://fixture.invalid',key:'test-only',fetchImpl:async url=>{requests++;if(url.includes('glitch_top20_snapshots'))throw Error('unavailable');return {ok:true,json:async()=>[]};}});assert.equal(requests,4);assert.equal(r.canonicalHolder.status,'unavailable');assert.equal(r.creator.status,'not_started');assert.equal(r.liquidity.status,'not_started');assert(!JSON.stringify(r).includes('test-only'));});
test('creator projection revalidates purchase bytes and withholds raw transaction',()=>{const r=JSON.parse(readFileSync(new URL('./fixtures/creator-launch-447328096.json',import.meta.url)));const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC',record={mint,status:'partial',stage:'selling',state:{originEvidence:[{creator}],originRecheck:{signature:r.signature},launchReconciliationTransaction:r.transaction}};const p=projectCreatorCheckpoint(record,mint);assert.equal(p.launchObservation.purchasedRaw,'15664233491746');assert.equal(p.selling,null);assert(!JSON.stringify(p).includes('innerInstructions'));record.state.launchReconciliationTransaction.meta.postBalances[0]--;assert.equal(projectCreatorCheckpoint(record,mint).launchObservation,null);});

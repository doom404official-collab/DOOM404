import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApprovedHolderEligibleView,HOLDER_RETAIN19_POLICY as policy} from '../lib/holderEligibleViewPolicy.mjs';
const incinerator='1nc1nerator11111111111111111111111111111111';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const fixture=()=>({id:policy.snapshotId,mint:policy.mint,slot:policy.slot,status:'frozen',supply_raw:'1000000000000000000000000',excluded_wallets:[incinerator],
 holder_ranking:[policy.infrastructurePool,...Array.from({length:19},(_,i)=>'2'.repeat(31)+alphabet[i])].map((wallet,i)=>({wallet,rank:i+1,balance:'10000000000000000000000'}))});
test('approved view retains original ranks and supply with exactly 19 eligible holders',()=>{
 const s=fixture(),before=JSON.stringify(s),r=buildApprovedHolderEligibleView(s);
 assert.equal(r.eligibleHolderCount,19);assert.equal(r.frozenHolderCount,20);assert.deepEqual(r.frozenRanking,s.holder_ranking);
 assert.deepEqual(r.eligibleRanking.map(h=>h.rank),Array.from({length:19},(_,i)=>i+2));assert.equal(r.supplyRaw,s.supply_raw);
 assert.deepEqual(r.eligibleExcludedWallets,[incinerator,policy.infrastructurePool]);assert.deepEqual(r.originalExcludedWallets,[incinerator]);
 for(const flag of ['replacementApplied','supplyRescaled','snapshotModified','checkpointModified','scorePromoted','historyComplete','calibrated','historicalStateVerified','snapshotProvenanceVerified'])assert.equal(r[flag],false);
 assert.equal(r.finalScore,null);assert.equal(r.policy.approvalReference,'Sentinel_066b8879683c8191b27bf71130e93a9e');assert.equal(JSON.stringify(s),before);
 r.frozenRanking[0].balance='0';r.eligibleRanking[0].balance='0';r.policy.id='changed';assert.equal(JSON.stringify(s),before);assert.equal(policy.id,'HOLDER_FROZEN_RETAIN19_V1');
});
for(const [name,mutate] of [
 ['snapshot',s=>s.id='other'],['mint',s=>s.mint='3'.repeat(32)],['slot',s=>s.slot++],
 ['replaced holder',s=>s.holder_ranking[0].wallet='4'.repeat(32)],['pool rank',s=>s.holder_ranking.reverse()],
 ['different exclusions',s=>s.excluded_wallets=[]],['already rewritten exclusion',s=>s.excluded_wallets.push(policy.infrastructurePool)],
 ['19-entry snapshot',s=>s.holder_ranking.shift()],['missing raw supply',s=>delete s.supply_raw]
])test(`approval cannot silently expand to ${name}`,()=>{
 const s=fixture();mutate(s);const before=JSON.stringify(s);assert.throws(()=>buildApprovedHolderEligibleView(s),/RETAIN19_|INVALID_FROZEN/);assert.equal(JSON.stringify(s),before);
});

test('approved eligible concentration uses 19 raw balances, preserving original 20 measurement and formula',async()=>{
 const {assessApprovedHolderEligibleConcentration}=await import('../lib/holderEligibleViewPolicy.mjs');
 const s=fixture(),before=JSON.stringify(s),r=assessApprovedHolderEligibleConcentration(s);
 assert.equal(r.policy.id,'HOLDER_ELIGIBLE_CONCENTRATION_V1');assert.equal(r.component.label,'Eligible-holder concentration');
 assert.equal(r.originalTop20.holderCount,20);assert.equal(r.originalTop20.sharePct,20);assert.equal(r.eligible.holderCount,19);assert.equal(r.eligible.sharePct,19);
 assert.equal(BigInt(r.originalTop20.numeratorRaw)-BigInt(r.eligible.numeratorRaw),BigInt(s.holder_ranking[0].balance));
 assert.equal(r.originalTop20.supplyRaw,s.supply_raw);assert.equal(r.eligible.supplyRaw,s.supply_raw);assert.equal(r.component.max,35);assert.equal(r.component.points,32.2);
 assert.equal(r.score,null);assert.equal(r.finalScore,null);assert.equal(r.calibrated,false);assert.equal(r.scorePromoted,false);assert.equal(JSON.stringify(s),before);
 assert.deepEqual(JSON.parse(JSON.stringify(r)),r);assert.deepEqual(assessApprovedHolderEligibleConcentration(JSON.parse(JSON.stringify(s))),r);
});
test('eligible component retains 15/65 boundaries and does not expand to unrelated snapshots',async()=>{
 const {assessApprovedHolderEligibleConcentration}=await import('../lib/holderEligibleViewPolicy.mjs');
 for(const [share,points] of [[15,35],[40,17.5],[65,0]]){
  const s=fixture();s.supply_raw='1000000';s.holder_ranking.forEach(h=>h.balance='0');s.holder_ranking[0].balance='1000';s.holder_ranking[1].balance=String(share*10000);
  const r=assessApprovedHolderEligibleConcentration(s);assert.equal(r.component.points,points);assert.equal(r.originalTop20.sharePct,share+0.1);
 }
 const s=fixture();s.id='legacy';const before=JSON.stringify(s);assert.throws(()=>assessApprovedHolderEligibleConcentration(s),/SCOPE/);assert.equal(JSON.stringify(s),before);
});

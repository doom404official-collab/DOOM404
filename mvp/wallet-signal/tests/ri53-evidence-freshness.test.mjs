import test from 'node:test';
import assert from 'node:assert/strict';
import {isFreshEvidence,EVIDENCE_MAX_AGE_MS} from '../lib/evidenceFreshnessV1.mjs';
import {practicalAssessmentV2} from '../lib/practicalScoringV2.mjs';
test('dynamic criteria expire at their individual boundaries; immutable receipts do not',()=>{
 const now=Date.parse('2026-11-28T12:00:00Z');
 for(const [kind,max] of Object.entries(EVIDENCE_MAX_AGE_MS)){
  assert.equal(isFreshEvidence(new Date(now-max).toISOString(),kind,now),true,kind);
  assert.equal(isFreshEvidence(new Date(now-max-1).toISOString(),kind,now),false,kind);
 }
 assert.equal(isFreshEvidence('2020-01-01T00:00:00Z','immutable_transaction',now),true);
 assert.equal(isFreshEvidence(new Date(now+1).toISOString(),'current_balances',now),false);
 assert.equal(isFreshEvidence(null,'current_balances',now),false);
});
test('twenty minute old holder evidence cannot score as current distribution',()=>{
 const mint='mint',now=Date.parse('2026-11-28T12:00:00Z');
 const sampledWalletObservation={version:2,atomicSubset:true,eligibleWallets:1,observedAt:new Date(now-1200000).toISOString(),supplyRaw:'100',wallets:[{wallet:'wallet',amountRaw:'49'}],observedSharePct:49,largestSharePct:49,contextSlots:{mint:1,sampledAccounts:1}};
 assert.equal(practicalAssessmentV2({result:{mint},concentration:{mint,sampledWalletObservation},now}).scores.holder_intelligence.coveragePct,0);
 sampledWalletObservation.observedAt=new Date(now).toISOString();
 assert.ok(practicalAssessmentV2({result:{mint},concentration:{mint,sampledWalletObservation},now}).scores.holder_intelligence.coveragePct>0);
});

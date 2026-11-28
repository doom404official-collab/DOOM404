import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeFrozenCrossJobNetwork as summarize} from '../lib/frozenCrossJobNetwork.mjs';
import {holderNetworkSnapshotIdentity} from '../lib/holderNetworkCheckpoint.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const wallet=n=>'2'.repeat(31)+alphabet[n];
const sig=n=>'3'.repeat(63)+alphabet[n];
const snapshot={id:'1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153',slot:457305617,mint:wallet(30),status:'frozen',supply_raw:'10000',excluded_wallets:[],holder_ranking:Array.from({length:20},(_,i)=>({wallet:wallet(i),balance:'100'}))};
const tx={signature:sig(1),from:wallet(0),to:wallet(1),slot:100,assetType:'SOL',mint:null,amountRaw:'1',verifiedOnChain:true,transferVerified:true};
function fixture(){
 const jobs=['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4'].map(id=>{
  const checkpoint={version:1,mint:snapshot.mint,holders:snapshot.holder_ranking.map(h=>({ownerWallet:h.wallet,sharePct:1})),signatures:{[sig(1)]:'checked',[sig(2)]:'pending'}};
  checkpoint.networkEvidence={version:1,snapshotIdentity:holderNetworkSnapshotIdentity(checkpoint),processed:{[sig(1)]:{valid:true,unresolvedTokenTransfers:0,transferCount:1}},transfers:[structuredClone(tx)],retentionLimited:false};
  return {id,mint:snapshot.mint,version:1,checkpoint};
 });return {snapshot:structuredClone(snapshot),jobs};
}
test('two jobs deduplicate economic observations without claiming snapshot attachment or history',()=>{
 const input=fixture(),before=JSON.stringify(input),r=summarize(input);
 assert.equal(r.status,'OBSERVED_ONLY');assert.equal(r.uniqueTransferRecords,1);assert.equal(r.coverage.retainedTransferRecords,2);assert.equal(r.coverage.duplicateEconomicRecords,1);
 assert.equal(r.coverage.uniquePendingSignatures,1);assert.equal(r.observed.evidence.directPairs,1);
 assert.equal(r.coverage.instructionIdentityComplete,false);assert.equal(r.snapshotProvenanceVerified,false);assert.equal(r.coverage.sourceSnapshotAttachmentVerified,false);
 assert.equal(r.finalScore,null);assert.equal(r.scorePromoted,false);assert.equal(r.historyComplete,false);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(summarize({...input,jobs:[...input.jobs].reverse()}).observed,r.observed);
});
for(const [name,mutate] of [
 ['missing evidence',x=>delete x.jobs[0].checkpoint.networkEvidence],
 ['schema',x=>x.jobs[0].checkpoint.networkEvidence.version=2],
 ['identity',x=>x.jobs[0].checkpoint.networkEvidence.snapshotIdentity='foreign'],
 ['retention',x=>x.jobs[0].checkpoint.networkEvidence.retentionLimited=true],
 ['counts',x=>x.jobs[0].checkpoint.networkEvidence.processed[sig(1)].transferCount=2],
 ['unresolved',x=>x.jobs[0].checkpoint.networkEvidence.processed[sig(1)].unresolvedTokenTransfers=1],
 ['invalid decoded',x=>x.jobs[0].checkpoint.networkEvidence.processed[sig(1)].valid=false],
 ['orphan',x=>x.jobs[0].checkpoint.networkEvidence.transfers[0].signature=sig(3)],
 ['wrong mint',x=>x.jobs[0].mint=wallet(31)],
 ['wrong checkpoint mint',x=>x.jobs[0].checkpoint.mint=wallet(31)],
 ['duplicate jobs',x=>x.jobs[1].id=x.jobs[0].id],
 ['missing processed',x=>x.jobs[0].checkpoint.networkEvidence.processed={}],
 ['missing signatures',x=>delete x.jobs[0].checkpoint.signatures],
 ['missing checked',x=>x.jobs[0].checkpoint.signatures[sig(1)]='pending'],
 ['invalid transfer',x=>x.jobs[0].checkpoint.networkEvidence.transfers[0].amountRaw='0'],
 ['unsafe supply number',x=>x.snapshot.supply_raw=1e20],
 ['unsafe balance number',x=>x.snapshot.holder_ranking[0].balance=1e20],
 ['negative supply',x=>x.snapshot.supply_raw='-1'],
 ['excess balances',x=>x.snapshot.holder_ranking[0].balance='10001'],
 ['wrong holder',x=>x.jobs[0].checkpoint.holders[0].ownerWallet=wallet(40)],
 ['duplicate holder',x=>x.snapshot.holder_ranking[1].wallet=wallet(0)],
 ['missing slot',x=>delete x.snapshot.slot],
 ['no checked evidence',x=>{for(const j of x.jobs){j.checkpoint.signatures={};j.checkpoint.networkEvidence.processed={};j.checkpoint.networkEvidence.transfers=[];}}],
])test(`fail closed without mutation: ${name}`,()=>{
 const input=fixture();mutate(input);const before=JSON.stringify(input),r=summarize(input);
 assert.equal(r.status,'unavailable');assert.equal(r.observed,null);assert.equal(r.finalScore,null);assert.equal(r.historyComplete,false);assert.equal(JSON.stringify(input),before);
});
test('same economic key with conflicting slot cannot depend on job ordering',()=>{
 const x=fixture();x.jobs[1].checkpoint.networkEvidence.transfers[0].slot++;
 assert.equal(summarize(x).reason,'GRAPH_TRANSFER_CONFLICT');x.jobs.reverse();assert.equal(summarize(x).reason,'GRAPH_TRANSFER_CONFLICT');
});
test('different transfer sets for the same decoded signature cannot be unioned',()=>{
 const x=fixture();x.jobs[1].checkpoint.networkEvidence.transfers[0].amountRaw='2';
 assert.equal(summarize(x).reason,'GRAPH_SIGNATURE_OBSERVATION_CONFLICT');
});
test('legacy and instruction-addressed evidence reconcile economic parity without inventing legacy identities',()=>{
 const x=fixture(),e=x.jobs[1].checkpoint.networkEvidence;
 e.transfers[0].instructionId=sig(1)+':0:outer';e.transfers.push({...e.transfers[0],instructionId:sig(1)+':1:outer'});e.processed[sig(1)].transferCount=2;
 const r=summarize(x);assert.equal(r.status,'OBSERVED_ONLY');assert.equal(r.uniqueTransferRecords,1);assert.equal(r.coverage.legacyInstructionRecords,1);assert.equal(r.observed.evidence.repeatedPairs,0);
});
test('same instruction cannot change economic content',()=>{
 const x=fixture();for(const j of x.jobs)j.checkpoint.networkEvidence.transfers[0].instructionId=sig(1)+':0:outer';
 x.jobs[1].checkpoint.networkEvidence.transfers[0].amountRaw='2';assert.equal(summarize(x).reason,'GRAPH_INSTRUCTION_CONFLICT');
});
test('failed and inspected state conflict is withheld; pending and checked overlap is counted once',()=>{
 const x=fixture();x.jobs[1].checkpoint.signatures[sig(2)]='checked';x.jobs[1].checkpoint.networkEvidence.processed[sig(2)]={valid:true,unresolvedTokenTransfers:0,transferCount:0};
 const r=summarize(x);assert.equal(r.coverage.uniqueProcessedSignatures,2);assert.equal(r.coverage.uniquePendingSignatures,0);
 x.jobs[0].checkpoint.signatures[sig(2)]='failed';assert.equal(summarize(x).reason,'GRAPH_SIGNATURE_STATE_CONFLICT');
});
test('frozen comparison identity changes with slot, supply, ranking, balance or exclusions without attaching source checkpoints',()=>{
 const original=summarize(fixture()).snapshotIdentity;
 for(const mutate of [s=>s.slot++,s=>s.supply_raw='10001',s=>s.holder_ranking.reverse(),s=>s.holder_ranking[0].balance='101',s=>s.excluded_wallets=[wallet(40)]]){
  const x=fixture();mutate(x.snapshot);const r=summarize(x);assert.equal(r.status,'OBSERVED_ONLY');assert.notEqual(r.snapshotIdentity,original);assert.equal(r.snapshotProvenanceVerified,false);
 }
});
test('raw cluster percentage uses exact integer supply and balances beyond Number precision',()=>{
 const x=fixture();x.snapshot.supply_raw='1000000000000000000000000';for(const h of x.snapshot.holder_ranking)h.balance='10000000000000000000000';
 assert.equal(summarize(x).observed.evidence.largestClusterPct,2);
});

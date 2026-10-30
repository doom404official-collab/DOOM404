import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreTop20Network} from '../lib/top20NetworkScore.mjs';
import {scoreHolderIntelligence} from '../lib/glitchAttributeEnginesV11.mjs';
import {assessVerifiedHolderConcentration} from '../lib/verifiedHolderConcentrationAssessment.mjs';
import {summarizeHolderNetworkCheckpoint,holderNetworkSnapshotIdentity} from '../lib/holderNetworkCheckpoint.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const wallet=n=>'2'.repeat(30)+alphabet[Math.floor(n/58)]+alphabet[n%58];
const sig=n=>'3'.repeat(62)+alphabet[Math.floor(n/58)]+alphabet[n%58];
const edge=(a,b,n)=>({signature:sig(n),from:wallet(a),to:wallet(b),slot:100,assetType:'SOL',mint:null,amountRaw:'1',verifiedOnChain:true,transferVerified:true});
function checkpoint(){const holders=Array.from({length:20},(_,i)=>({ownerWallet:wallet(i),tokenAccount:wallet(i+20),amountRaw:'100',sharePct:1}));
 const c={version:1,mint:wallet(50),holders,snapshot:{supplyRaw:'10000',largestAccountsSlot:100,supplySlot:100,ownerSlots:Array(20).fill(100)},wallets:Object.fromEntries(holders.map(h=>[h.ownerWallet,{}])),edges:{},signatures:{[sig(1)]:'checked'}};
 c.networkEvidence={version:1,snapshotIdentity:holderNetworkSnapshotIdentity(c),retentionLimited:false,processed:{[sig(1)]:{valid:true,unresolvedTokenTransfers:0,transferCount:1}},transfers:[edge(0,1,1)]};return c;
}
for(const value of [undefined,null,false,'false','true',1,[],{}])test(`provenance ${JSON.stringify(value)} cannot unlock observed network score`,()=>{
 assert.equal(summarizeHolderNetworkCheckpoint(checkpoint(),{snapshotProvenanceVerified:value}).score,null);
});
test('raw aggregate concentration is converted once, preserving mass at rounding boundaries',()=>{
 const c=checkpoint(),supply='10000000';c.snapshot.supplyRaw=supply;
 // Actual aggregate 20.0076%; individual truncation totals 20.0060%.
 c.holders.forEach(h=>{h.amountRaw='100038';h.sharePct=1.0003;});
 assert.equal(scoreHolderIntelligence({top20SharePct:20.006}).components[0].points,31.5);
 const expected=scoreHolderIntelligence({top20SharePct:20.0076}).components[0].points;
 assert.equal(expected,31.49);
 const r=assessVerifiedHolderConcentration({checkpoint:c});assert.equal(r.components[0].score,expected);assert.equal(r.score,null);
 const reversed=structuredClone(c);reversed.holders.reverse();assert.equal(assessVerifiedHolderConcentration({checkpoint:reversed}).components[0].score,expected);
});
test('very large raw balances retain exact aggregate scoring without Number conversion',()=>{
 const c=checkpoint();c.snapshot.supplyRaw='1000000000000000000000000000';
 for(const h of c.holders){h.amountRaw='10000000000000000000000000';h.sharePct=1;}
 assert.equal(assessVerifiedHolderConcentration({checkpoint:c}).components[0].score,31.5);
});
test('deterministic raw network score across holder/transfer order and economic duplicates',()=>{
 const holders=Array.from({length:20},(_,i)=>({wallet:wallet(i),sharePct:1,amountRaw:'100000000000000000000'}));
 const transfers=[edge(0,1,1),edge(1,0,2),edge(0,1,3),edge(1,50,4),edge(50,2,5),edge(3,4,6)];
 const input={holders,transfers,supplyRaw:'10000000000000000000000'},before=JSON.stringify(input),baseline=scoreTop20Network(input);
 for(let n=0;n<20;n++){
  const rotated=[...holders.slice(n),...holders.slice(0,n)],r=scoreTop20Network({...input,holders:rotated,transfers:[...transfers.slice().reverse(),...transfers]});
  assert.equal(r.score,baseline.score);assert.deepEqual(r.penalties,baseline.penalties);assert.equal(r.evidence.largestClusterPct,3);assert.equal(r.evidence.repeatedPairs,1);
  assert.equal(r.historyComplete,false);assert.equal(r.calibrated,false);assert.equal(r.commonOwnershipEstablished,false);
 }
 assert.equal(JSON.stringify(input),before);
});
test('direct, repeated and intermediary classifications preserve existing precedence',()=>{
 const holders=[0,1,2,3].map(i=>({wallet:wallet(i),sharePct:1,amountRaw:'100'}));
 const transfers=[edge(0,1,1),edge(1,0,1),edge(0,1,2),edge(0,1,3),edge(1,50,4),edge(50,2,5),edge(2,51,6),edge(51,3,7)];
 const r=scoreTop20Network({holders,transfers,supplyRaw:'10000'});
 assert.equal(r.evidence.directPairs,1);assert.equal(r.evidence.repeatedPairs,1);assert.equal(r.evidence.directHolders,2);assert.equal(r.evidence.indirectHolders,2);assert.equal(r.evidence.connectedHolderCount,4);
 assert.deepEqual(r.penalties,{direct:0.67,repeated:1,indirect:1,concentration:1.71});assert.equal(r.score,30.62);
});
for(const mutate of [c=>delete c.networkEvidence,c=>c.networkEvidence.retentionLimited=true,c=>c.networkEvidence.processed[sig(1)].unresolvedTokenTransfers=1,c=>c.networkEvidence.processed={},c=>delete c.snapshot.supplyRaw,c=>delete c.holders[0].amountRaw])test('missing, legacy and unresolved retained evidence withholds observed score',()=>{
 const c=checkpoint();mutate(c);const r=summarizeHolderNetworkCheckpoint(c,{snapshotProvenanceVerified:true});assert.equal(r.status,'unavailable');assert.equal(r.score,null);
});
test('diagnostic scores and claimed checkpoint completion cannot promote consolidated components',()=>{
 const c=checkpoint();Object.assign(c,{archiveCompletenessProven:true,historyComplete:true,calibrated:true,score:100,networkScore:35,independencePoints:10});
 c.networkEvidence.historyComplete=true;c.networkEvidence.calibrated=true;
 const r=assessVerifiedHolderConcentration({checkpoint:c,custodyClassificationComplete:true,evidenceRows:[]});
 assert.equal(r.observedNetwork.status,'observed_evidence');assert.equal(r.observedNetwork.historyComplete,false);assert.equal(r.observedNetwork.calibrated,false);
 assert.equal(r.score,null);assert.equal(r.provisionalScore,null);assert.equal(r.complete,false);assert.equal(r.calibrated,false);
 assert.deepEqual(r.components.map(c=>c.score),[31.5,null,null,null]);assert.equal(r.scoreCoveragePct,35);assert.equal(r.unscoredPoints,65);
});
test('pending and failed coverage remains explicit and cannot imply final acceptance',()=>{
 const c=checkpoint();c.signatures[sig(2)]='pending';c.signatures[sig(3)]='failed';
 const r=assessVerifiedHolderConcentration({checkpoint:c});assert.equal(r.observedNetwork.coverage.pendingTransactions,1);assert.equal(r.observedNetwork.coverage.failedTransactions,1);assert.equal(r.score,null);assert.equal(r.historyComplete,false);
});
test('hypothetical 19-holder exclusion does not change fixed penalty thresholds or total supply',()=>{
 const holders=Array.from({length:20},(_,i)=>({wallet:wallet(i),sharePct:1,amountRaw:'100'}));
 const infrastructureWallets=[wallet(0)],transfers=[edge(1,2,1),edge(2,1,2),edge(1,2,3),edge(0,3,4)];
 const input={holders,transfers,supplyRaw:'10000',infrastructureWallets};
 const excluded=scoreTop20Network(input),explicit19=scoreTop20Network({...input,holders:holders.slice(1)});
 assert.deepEqual(excluded,explicit19);assert.equal(excluded.evidence.largestClusterPct,2);
 assert.deepEqual(excluded.penalties,{direct:0.67,repeated:1,indirect:0,concentration:0.86});
 assert.equal(excluded.historyComplete,false);assert.equal(excluded.calibrated,false);
 assert.equal(input.holders.length,20);assert.equal(input.supplyRaw,'10000');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreTop20Network} from '../lib/top20NetworkScore.mjs';
import {extractHolderNetworkTransfers} from '../lib/holderNetworkTransfers.mjs';
import {recordHolderNetworkTransaction,summarizeHolderNetworkCheckpoint,NETWORK_RETENTION_LIMITS} from '../lib/holderNetworkCheckpoint.mjs';
import {scanHolderHistoryBatch} from '../lib/holderHistoryEngine.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const wallet=i=>'A'.repeat(30)+alphabet[Math.floor(i/58)]+alphabet[i%58];
const sig=i=>'B'.repeat(62)+alphabet[Math.floor(i/58)]+alphabet[i%58];
const edge=(a,b,i)=>({from:wallet(a),to:wallet(b),signature:sig(i),slot:10,assetType:'SOL',mint:null,amountRaw:'1',verifiedOnChain:true,transferVerified:true});
// Recorded aggregate calibration inputs, NOT fabricated on-chain transactions.
// Synthetic graph fixtures realize those counts; signatures below are test data.
const cases=[{snapshotId:'8bfd2ea655c9d363b53f50c0416f58bd5e8ef313ddea0d67af42fc3eafa7d34a',slot:457273431,indirect:7,cluster:24.43,score:12.36,concentration:10.47},
 {snapshotId:'1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153',slot:457305617,indirect:6,cluster:22.26,score:13.79,concentration:9.54}];
for(const c of cases)test(`historical aggregate fixture ${c.snapshotId} at slot ${c.slot}`,()=>{
 const holders=Array.from({length:20},(_,i)=>({wallet:wallet(i),sharePct:i===0?c.cluster:0}));
 const transfers=Array.from({length:7},(_,i)=>edge(i,i+1,i));
 for(let i=0;i<4;i++)transfers.push(edge(i,i+1,7+i*2),edge(i+1,i,8+i*2));
 transfers.push(edge(0,50,20));for(let i=0;i<c.indirect;i++)transfers.push(edge(50,8+i,21+i));
 const r=scoreTop20Network({holders,transfers});
 assert.equal(r.score,c.score);assert.deepEqual(r.penalties,{direct:4.67,repeated:4,indirect:c.indirect/2,concentration:c.concentration});
 assert.equal(r.historyComplete,false);assert.equal(r.calibrated,false);assert.equal(r.commonOwnershipEstablished,false);
});
test('unordered signature dedup; repetition requires three unique signatures',()=>{
 const holders=[0,1].map(i=>({wallet:wallet(i),sharePct:1}));
 let transfers=[edge(0,1,0),edge(1,0,0),edge(0,1,1)];
 assert.equal(scoreTop20Network({holders,transfers}).evidence.repeatedPairs,0);
 transfers.push(edge(0,1,2));assert.equal(scoreTop20Network({holders,transfers}).evidence.repeatedPairs,1);
});
test('infrastructure is excluded from direct pairs and intermediary paths',()=>{
 const r=scoreTop20Network({holders:[0,1].map(i=>({wallet:wallet(i),sharePct:1})),transfers:[edge(0,50,0),edge(50,1,1)],infrastructureWallets:[wallet(50)]});
 assert.equal(r.evidence.connectedHolderCount,0);assert.equal(r.evidence.directPairs,0);
});
test('asserted observations and nonfinite exposure cannot enter scorer',()=>{
 const holders=[{wallet:wallet(0),sharePct:1},{wallet:wallet(1),sharePct:1}];
 for(const changes of [{verifiedOnChain:false},{transferVerified:false},{signature:'bad'},{amountRaw:'0'},{assetType:'UNVERIFIED'},{from:wallet(1)}])assert.throws(()=>scoreTop20Network({holders,transfers:[{...edge(0,1,0),...changes}]}));
 assert.throws(()=>scoreTop20Network({holders:[{wallet:wallet(0),sharePct:NaN}],transfers:[]}));
});
const tx=(i=0)=>({slot:10,meta:{err:null,innerInstructions:[]},transaction:{signatures:[sig(i)],message:{accountKeys:[],instructions:[{programId:'11111111111111111111111111111111',program:'system',parsed:{type:'transfer',info:{source:wallet(0),destination:wallet(50),lamports:1}}}]}}});
test('extracts genuine parsed SOL instructions, not cooccurrence, failures or a false program',()=>{
 assert.equal(extractHolderNetworkTransfers({transaction:tx(),signature:sig(0)}).transfers.length,1);
 for(const mutate of [t=>t.meta.err={InstructionError:[0,'error']},t=>t.transaction.signatures=[sig(1)],t=>t.transaction.message.instructions[0].programId=wallet(10),t=>t.transaction.message.instructions[0].parsed.info.lamports=0]){
  const t=tx();mutate(t);assert.equal(extractHolderNetworkTransfers({transaction:t,signature:sig(0)}).transfers.length,0);
 }
});
test('cross-asset SPL and Token2022 resolve owners solely from tx-local metadata, including inner instructions',()=>{
 for(const programId of ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']){
  const t=tx();t.transaction.message.accountKeys=[wallet(30),wallet(31)];t.transaction.message.instructions=[];
  t.meta.preTokenBalances=[{accountIndex:0,owner:wallet(0),mint:wallet(40)},{accountIndex:1,owner:wallet(50),mint:wallet(40)}];
  t.meta.innerInstructions=[{instructions:[{programId,parsed:{type:'transferChecked',info:{source:wallet(30),destination:wallet(31),mint:wallet(40),tokenAmount:{amount:'15'}}}}]}];
  let r=extractHolderNetworkTransfers({transaction:t,signature:sig(0)});assert.equal(r.transfers.length,1);assert.equal(r.transfers[0].to,wallet(50));
  t.meta.postTokenBalances=[{accountIndex:1,owner:wallet(2),mint:wallet(40)}];r=extractHolderNetworkTransfers({transaction:t,signature:sig(0)});assert.equal(r.transfers.length,0);assert.equal(r.unresolvedTokenTransfers,1);
 }
});
const checkpoint=()=>({mint:wallet(40),snapshot:{supplyRaw:'100'},holders:[{ownerWallet:wallet(0),sharePct:10,amountRaw:'10'},{ownerWallet:wallet(1),sharePct:10,amountRaw:'10'}],wallets:{[wallet(0)]:{exhausted:true},[wallet(1)]:{exhausted:true}},signatures:{[sig(0)]:'checked'},edges:{}});
test('new evidence survives JSON roundtrip; missing legacy evidence remains unknown',()=>{
 const c=checkpoint();recordHolderNetworkTransaction(c,{transaction:tx(),signature:sig(0)});
 const projection=summarizeHolderNetworkCheckpoint(JSON.parse(JSON.stringify(c)),{snapshotProvenanceVerified:true});assert.equal(projection.status,'observed_evidence');
 c.signatures[sig(1)]='checked';assert.equal(summarizeHolderNetworkCheckpoint(c,{snapshotProvenanceVerified:true}).score,null);
 assert.equal(summarizeHolderNetworkCheckpoint(c).score,null);
});
test('retention caps and unresolved token owners withhold observed score rather than defaulting to zero links',()=>{
 const c=checkpoint();recordHolderNetworkTransaction(c,{transaction:tx(),signature:sig(0)});
 c.networkEvidence.processed[sig(0)].unresolvedTokenTransfers=1;assert.equal(summarizeHolderNetworkCheckpoint(c,{snapshotProvenanceVerified:true}).reason,'NETWORK_TOKEN_OWNERS_UNRESOLVED');
 c.networkEvidence.retentionLimited=true;assert.equal(summarizeHolderNetworkCheckpoint(c,{snapshotProvenanceVerified:true}).score,null);
 assert.equal(NETWORK_RETENTION_LIMITS.transfers,20000);
});
test('real scan producer retains bounded network evidence without extra RPC; final historical gate stays false',async()=>{
 const c=checkpoint();c.signatures[sig(0)]='pending';let requests=0;
 const r=await scanHolderHistoryBatch({checkpoint:c,rpc:async()=>{requests++;return tx();},maxRequests:1});
 assert.equal(requests,1);assert.equal(r.checkpoint.networkEvidence.transfers.length,1);assert.equal(r.summary.archiveCompletenessProven,false);
});
test('missing parsed instruction lists are unknown, not empty histories',()=>{
 for(const mutate of [t=>delete t.transaction.message,t=>delete t.transaction.message.instructions,t=>t.meta.innerInstructions=null,t=>delete t.transaction.message.accountKeys]){
  const t=tx();mutate(t);assert.equal(extractHolderNetworkTransfers({transaction:t,signature:sig(0)}).valid,false);
 }
});
test('raw-backed cluster exposure avoids summing quantized shares',()=>{
 const holders=[{wallet:wallet(0),sharePct:5.0024,amountRaw:'500249'},{wallet:wallet(1),sharePct:5.0025,amountRaw:'500251'}];
 const r=scoreTop20Network({holders,supplyRaw:'10000000',transfers:[edge(0,1,0)]});
 assert.equal(r.evidence.largestClusterPct,10.01);
});
test('persisted validity must be true and retained transfer counts must match',()=>{
 for(const mutate of [c=>c.networkEvidence.processed[sig(0)].valid='false',c=>c.networkEvidence.transfers=[],c=>c.networkEvidence.retentionLimited=undefined,c=>c.mint=wallet(41)]){
  const c=checkpoint();recordHolderNetworkTransaction(c,{transaction:tx(),signature:sig(0)});mutate(c);
  assert.equal(summarizeHolderNetworkCheckpoint(c,{snapshotProvenanceVerified:true}).score,null);
 }
});
test('original high-degree policy is strictly above 100 peers; direct pair penalty precedes hub filtering',()=>{
 const holders=[0,1].map(i=>({wallet:wallet(i),sharePct:1}));
 const transfers=Array.from({length:100},(_,i)=>edge(0,i+1,i));
 assert.equal(scoreTop20Network({holders,transfers}).evidence.excludedHighDegreeHubCount,0);
 transfers.push(edge(0,101,100));const r=scoreTop20Network({holders,transfers});
 assert.equal(r.evidence.excludedHighDegreeHubCount,1);assert.equal(r.evidence.directPairs,1);assert.equal(r.evidence.connectedHolderCount,0);
});
test('bounded retention marks incomplete before dropping additional records',()=>{
 const c=checkpoint();recordHolderNetworkTransaction(c,{transaction:tx(),signature:sig(0)});
 c.networkEvidence.transfers=Array(NETWORK_RETENTION_LIMITS.transfers).fill(edge(0,50,0));
 c.signatures[sig(1)]='checked';recordHolderNetworkTransaction(c,{transaction:tx(1),signature:sig(1)});
 assert.equal(c.networkEvidence.retentionLimited,true);assert.equal(c.networkEvidence.transfers.length,NETWORK_RETENTION_LIMITS.transfers);
 assert.equal(summarizeHolderNetworkCheckpoint(c,{snapshotProvenanceVerified:true}).score,null);
});
test('assessment projects observed evidence but cannot grant network, independence or final score',async()=>{
 const {assessVerifiedHolderConcentration}=await import('../lib/verifiedHolderConcentrationAssessment.mjs');
 const c=checkpoint();c.holders=Array.from({length:20},(_,i)=>({ownerWallet:wallet(i),tokenAccount:wallet(i+100),amountRaw:'1',sharePct:1}));
 c.wallets=Object.fromEntries(c.holders.map(h=>[h.ownerWallet,{exhausted:true}]));
 c.snapshot={supplyRaw:'100',largestAccountsSlot:10,supplySlot:10,ownerSlots:Array(20).fill(10)};
 recordHolderNetworkTransaction(c,{transaction:tx(),signature:sig(0)});
 const r=assessVerifiedHolderConcentration({checkpoint:JSON.parse(JSON.stringify(c)),custodyClassificationComplete:true});
 assert.equal(r.observedNetwork.status,'observed_evidence');assert.equal(r.score,null);assert.equal(r.historyComplete,false);assert.equal(r.calibrated,false);
 for(const part of r.components.slice(1))assert.equal(part.score,null);
});
test('unsupported or malformed known transfer instructions remain unknown',()=>{
 for(const mutate of [t=>delete t.transaction.message.instructions[0].parsed.info,t=>delete t.transaction.message.instructions[0].parsed.info.lamports,t=>t.transaction.message.instructions[0].parsed.info.lamports=Number.MAX_SAFE_INTEGER+1,t=>t.transaction.message.instructions[0].parsed.type='transferWithSeed',t=>t.transaction.message.instructions[0].parsed.type='transferCheckedWithFee']){
  const t=tx();mutate(t);const r=extractHolderNetworkTransfers({transaction:t,signature:sig(0)});assert.ok(r.unresolvedTokenTransfers>0);assert.equal(r.transfers.length,0);
 }
});
test('token owner change away and back prevents end-state ownership attribution',()=>{
 const t=tx(),programId='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
 t.transaction.message.accountKeys=[wallet(30),wallet(31)];
 t.meta.preTokenBalances=t.meta.postTokenBalances=[{accountIndex:0,owner:wallet(0),mint:wallet(40)},{accountIndex:1,owner:wallet(1),mint:wallet(40)}];
 t.transaction.message.instructions=[{programId,parsed:{type:'setAuthority',info:{account:wallet(30),authorityType:'accountOwner',newAuthority:wallet(2)}}},
 {programId,parsed:{type:'transfer',info:{source:wallet(30),destination:wallet(31),amount:'1'}}},
 {programId,parsed:{type:'setAuthority',info:{account:wallet(30),authorityType:'accountOwner',newAuthority:wallet(0)}}}];
 const r=extractHolderNetworkTransfers({transaction:t,signature:sig(0)});assert.equal(r.transfers.length,0);assert.equal(r.unresolvedTokenTransfers,1);
});

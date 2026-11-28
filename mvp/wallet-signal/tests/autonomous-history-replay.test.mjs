import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keypair} from '@solana/web3.js';
import {investigateToken} from '../lib/boundedTokenInvestigation.mjs';
import {verifyBoundedCreatorOrigin} from '../lib/boundedCreatorOriginV2.mjs';
import {prepareCreatorHistoryCheckpoint,CREATOR_HISTORY_DECODER_EPOCH} from '../lib/creatorTokenHistoryV1.mjs';
import {verifyPumpHolderRewardReceipt} from '../lib/pumpHolderRewardReceipt.mjs';
import {summarizeCreatorAcquisitionLedger} from '../lib/creatorAcquisitionLedger.mjs';
import {deduplicateCreatorEvents} from '../lib/creatorHistoryAccountingV1.mjs';
const root=new URL('../docs/forensic-ri76-90/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n+'.json',root))).response.result;
const mint='9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump';
const creator=verifyBoundedCreatorOrigin(read('dcty-origin'),mint).creator;
const history=fs.readdirSync(root).filter(n=>/^dcty-history-\d+.json$/.test(n)).map(n=>read(n.slice(0,-5))).sort((a,b)=>a.slot-b.slot||(a.transactionIndex||0)-(b.transactionIndex||0));
const identity=e=>[e.signature,e.instructionIndex,e.innerInstructionIndex??'outer'].join(':');
const reference=history.map(transaction=>verifyPumpHolderRewardReceipt({mint,creator,transaction,signature:transaction.transaction.signatures[0]})).filter(Boolean);
// Synthetic exhausted pre-upgrade state built exclusively from already-public
// reference receipts. Private Vault captures are not required by the tests.
const baseline={mint,investigationRevision:8,observedAt:'2026-11-28T13:00:00Z',creator:{creator,events:reference.slice(-11)},creatorHistoryCheckpoint:{version:1,mint,creator,addressWindowExhausted:true,completedTargets:['legacy-assessed-account'],accountAssociations:[]},transactionCache:[read('dcty-origin')]};
test('rewards and ordinary receipts have disjoint subtotals without changing total inflow or treating rewards as purchases',()=>{
 const transfer={...reference[0],signature:'ordinary-transfer',amountRaw:'123',acquisitionMechanism:'direct_incoming_transfer'};
 const ledger=summarizeCreatorAcquisitionLedger({mint,creator:baseline.creator.creator,events:[...reference,transfer]});
 assert.equal(ledger.rewardReceivedRaw,'2006484278');assert.equal(ledger.ordinaryIncomingRaw,'123');
 assert.equal(ledger.totalAcquiredRaw,'2006484401');assert.equal(ledger.externalReceivedRaw,'2006484401');
 assert.equal(ledger.purchasedRaw,'0');assert.equal(ledger.scoreEligible,false);
 const ambiguous=deduplicateCreatorEvents([reference[0],{...reference[0],acquisitionMechanism:'direct_incoming_transfer'}]);
 assert.equal(ambiguous.length,2);
 const conflict=summarizeCreatorAcquisitionLedger({mint,creator:baseline.creator.creator,events:ambiguous});
 assert.equal(conflict.acceptedCount,0);assert.equal(conflict.rejected[0].reason,'CONFLICTING_DUPLICATE');
});
function rpcAdapter(){const calls=[];return {calls,rpc:async(method,params)=>{
 calls.push({method,params});
 if(method==='getTransactionsForAddress'){
  if(params[0]===mint)return {data:[read('dcty-origin')],paginationToken:null};
  const offset=params[1].paginationToken?Number(params[1].paginationToken):0;
  return {data:history.slice(offset,offset+12),paginationToken:offset+12<history.length?String(offset+12):null};
 }
 if(method==='getTokenAccountsByOwner')return read('dcty-current');
 throw Error('HOLDER_SCOPE_UNAVAILABLE_IN_RECORDED_CREATOR_REPLAY');
}};}
test('decoder upgrade clears exhausted progress, preserving account associations and original evidence',()=>{
 assert.equal(baseline.creator.events.length,11);
 assert.equal(baseline.creatorHistoryCheckpoint.addressWindowExhausted,true);
 const p=prepareCreatorHistoryCheckpoint(baseline,mint,baseline.creator.creator);
 assert.equal(p.paginationToken,undefined);assert.deepEqual(p.completedTargets,[]);
 assert.equal(p.decoderEpoch,CREATOR_HISTORY_DECODER_EPOCH);
 assert.deepEqual(p.accountAssociations,baseline.creatorHistoryCheckpoint.accountAssociations);
 assert.equal(baseline.creatorHistoryCheckpoint.addressWindowExhausted,true);
 assert.equal(prepareCreatorHistoryCheckpoint(baseline,'unrelated',baseline.creator.creator),null);
});
test('exhausted indexed window is refreshed after expiry so later events are not permanently hidden',()=>{
 const p=prepareCreatorHistoryCheckpoint(baseline,mint,baseline.creator.creator);
 const observation={...baseline,observedAt:'2026-11-28T12:00:00Z',creatorHistoryCheckpoint:{...p,addressWindowExhausted:true,completedTargets:['account']}};
 assert.equal(prepareCreatorHistoryCheckpoint(observation,mint,baseline.creator.creator,Date.parse('2026-11-28T12:59:59Z')),observation.creatorHistoryCheckpoint);
 const refreshed=prepareCreatorHistoryCheckpoint(observation,mint,baseline.creator.creator,Date.parse('2026-11-28T13:00:00Z'));
 assert.equal(refreshed.replayReason,'exhausted_window_freshness_refresh');assert.deepEqual(refreshed.completedTargets,[]);
 assert.deepEqual(refreshed.accountAssociations,p.accountAssociations);
});
for(const warm of [false,true])test(`recorded normal pipeline ${warm?'upgrades exhausted legacy checkpoint':'starts cold'} and recovers exact 26 reward identities in one bounded pass`,async()=>{
 const {rpc,calls}=rpcAdapter();const result=await investigateToken({mint,rpc,previousObservation:warm?baseline:null,now:()=>Date.parse('2026-11-28T16:00:00Z')});
 const events=result.creator.events.filter(e=>e.acquisitionMechanism==='protocol_holder_reward_distribution');
 assert.equal(reference.length,26);assert.deepEqual(events.map(identity).sort(),reference.map(identity).sort());
 assert.equal(events.reduce((n,e)=>n+BigInt(e.amountRaw),0n),2006484278n);
 assert.equal(calls.filter(c=>c.method==='getTokenAccountsByOwner').length,1);
 assert.equal(calls.filter(c=>c.method==='getTransactionsForAddress'&&c.params[0]!==mint).length,3);
 assert.ok(calls.length<=18);assert.equal(result.historyComplete,false);
 const second=rpcAdapter();const repeated=await investigateToken({mint,rpc:second.rpc,previousObservation:result,now:()=>Date.parse('2026-11-28T16:01:00Z')});
 assert.deepEqual(repeated.creator.events.map(identity).sort(),result.creator.events.map(identity).sort());
 assert.equal(second.calls.filter(c=>c.method==='getTransactionsForAddress').length,0);
 assert.equal(second.calls.filter(c=>c.method==='getTokenAccountsByOwner').length,1);
 assert.equal(repeated.creatorHistoryCheckpoint.decoderEpoch,CREATOR_HISTORY_DECODER_EPOCH);
  assert.equal(repeated.creatorHistoryCheckpoint.lastWindowAssessedAt,result.creatorHistoryCheckpoint.lastWindowAssessedAt);
});
test('three creator pages replace holder receipt reads and stay within the full original request plan',async()=>{
 const adapter=rpcAdapter(),owners=Array.from({length:3},()=>Keypair.generate().publicKey.toBase58()),accounts=owners.map(()=>Keypair.generate().publicKey.toBase58());
 const token='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';let transactionReads=0;
 const result=await investigateToken({mint,now:()=>Date.parse('2026-11-28T16:00:00Z'),rpc:async(method,params)=>{
  if(method==='getTokenLargestAccounts')return {context:{slot:500},value:accounts.map(address=>({address}))};
  if(method==='getMultipleAccounts')return params[0][0]===mint?{context:{slot:500},value:[{executable:false,owner:token,data:{parsed:{type:'mint',info:{isInitialized:true,supply:'1000000000000000',decimals:6}}}},...owners.map(owner=>({executable:false,owner:token,data:{parsed:{type:'account',info:{mint,owner,tokenAmount:{amount:'10000000000000'}}}}}))]}:{context:{slot:500},value:owners.map(()=>null)};
  if(method==='getSignaturesForAddress')return Array.from({length:6},(_,i)=>({signature:params[0]+i,err:null,blockTime:1795881599}));
  if(method==='getTransaction'){transactionReads++;return null;}
  return adapter.rpc(method,params);
 }});
 assert.ok(result.execution.requests>=16&&result.execution.requests<=17);assert.equal(transactionReads,6);
 assert.equal(result.creator.events.filter(e=>e.acquisitionMechanism==='protocol_holder_reward_distribution').length,26);assert.equal(result.historyComplete,false);
});

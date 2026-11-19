import test from 'node:test';
import assert from 'node:assert/strict';
import {collectWalletSignaturePage} from '../lib/holderHistoryPagination.mjs';
import {createHolderHistoryCheckpoint,recordHistoryPage} from '../lib/holderHistoryCheckpoint.mjs';
import {scanHolderHistoryBatch} from '../lib/holderHistoryEngine.mjs';
import {holderNetworkSnapshotIdentity} from '../lib/holderNetworkCheckpoint.mjs';
const signature=n=>('1'.repeat(88)+n.toString(16).split('').map(c=>'23456789ABCDEFGH'[parseInt(c,16)]).join('')).slice(-88);
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',a='3'.repeat(32),b='4'.repeat(32);
function fixture(){const cp=createHolderHistoryCheckpoint({mint,holders:[{ownerWallet:a,tokenAccount:'5'.repeat(32),sharePct:1},{ownerWallet:b,tokenAccount:'6'.repeat(32),sharePct:1}]});cp.snapshot={slot:457305617};return cp;}
const tx=(s,slot=100)=>({slot,version:'legacy',meta:{err:null,innerInstructions:[],preTokenBalances:[],postTokenBalances:[]},transaction:{signatures:[s],message:{accountKeys:[a,b],instructions:[{program:'system',programId:'11111111111111111111111111111111',parsed:{type:'transfer',info:{source:a,destination:b,lamports:7}}}]}}});
const entry=(n,slot=100,err=null)=>({signature:signature(n),slot,err});
const scan=(checkpoint,rpc,opts={})=>scanHolderHistoryBatch({checkpoint,rpc,maxRequests:4,pageLimit:2,...opts});

for(const page of [[{signature:'' ,slot:1,err:null}],[{signature:'   ',slot:1,err:null}],[{signature:signature(1),slot:1}],[{signature:signature(1),err:null}],[entry(1,-1)],[entry(1,1,false)],[entry(1,1,[])],[entry(1,1),entry(2,2)],[entry(1),entry(2),entry(3)]])test('invalid pagination never advances retained checkpoint '+JSON.stringify(page),async()=>{
 const cp=fixture(),before=structuredClone(cp);
 const result=await scan(cp,async()=>page,{maxRequests:1});
 assert.match(result.summary.reason,/INVALID/);assert.deepEqual(cp,before);
});
test('empty page preserves last cursor and slot; provider exhaustion remains non-archival',async()=>{
 const cp=fixture();cp.wallets[a].cursor=signature(1);cp.wallets[a].oldestSlot=99;
 const p=await collectWalletSignaturePage({wallet:a,cursor:signature(1),cursorSlot:99,limit:2,fetchPage:async()=>[]});recordHistoryPage(cp,{wallet:a,page:p});
 assert.equal(cp.wallets[a].cursor,signature(1));assert.equal(cp.wallets[a].oldestSlot,99);assert.equal(cp.wallets[a].exhausted,true);assert.equal(cp.archiveCompletenessProven,false);
});
test('short inclusive cursor and cross-page slot reversal reject before progress',async()=>{
 for(const entries of [[entry(1,99)],[entry(2,100)]])await assert.rejects(collectWalletSignaturePage({wallet:a,cursor:signature(1),cursorSlot:99,limit:2,fetchPage:async()=>entries}),/STALLED|ORDER_INVALID/);
});
test('failed-only full pages advance raw cursor without queueing ineligible transactions',async()=>{
 const cp=fixture(),page=await collectWalletSignaturePage({wallet:a,limit:2,fetchPage:async()=>[entry(1,100,{InstructionError:[0,'invalid']}),entry(2,99,'AccountNotFound')]});
 recordHistoryPage(cp,{wallet:a,page});assert.equal(cp.wallets[a].cursor,signature(2));assert.equal(cp.wallets[a].oldestSlot,99);assert.equal(cp.wallets[a].exhausted,false);assert.deepEqual(cp.signatures,{});
});
test('same-slot pages are valid and cross-wallet duplicate signatures decode only once',async()=>{
 const cp=fixture(),calls=[];let pages=0;
 const result=await scan(cp,async(method,params)=>{
  calls.push([method,params[0]]);if(method==='getTransaction')return tx(params[0]);pages++;return [entry(1,100)];
 },{maxRequests:4});
 assert.equal(pages,2);assert.equal(calls.filter(([m])=>m==='getTransaction').length,1);
 assert.equal(cp.networkEvidence.transfers.length,1);assert.equal(result.summary.transactionsChecked,1);assert.equal(result.summary.providerHistoryExhausted,true);assert.equal(result.summary.archiveCompletenessProven,false);
});
for(const make of [()=>null,()=>undefined,()=>({}),s=>({...tx(s),meta:null}),s=>({...tx(s),transaction:{...tx(s).transaction,signatures:[signature(99)]}}),s=>({...tx(s),meta:{...tx(s).meta,err:{InstructionError:[0,'bad']}}}),s=>({...tx(s),meta:{...tx(s).meta,innerInstructions:null}}),s=>({...tx(s),slot:NaN})])test('unavailable or unverified transaction stays pending without evidence',async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';const snapshot=structuredClone(cp.snapshot);
 const result=await scan(cp,async()=>make(s),{maxRequests:1});
 assert.equal(cp.signatures[s],'pending');assert.deepEqual(cp.edges,{});assert.equal(cp.networkEvidence,undefined);assert.equal(result.summary.transactionsChecked,0);assert.equal(result.summary.providerHistoryExhausted,false);assert.deepEqual(cp.snapshot,snapshot);
 assert.equal(result.summary.decodeUnavailable+result.summary.decodeUnverified,1);
});
test('successful identity-checked decode is idempotent across persisted resume',async()=>{
 let cp=fixture();const s=signature(1);cp.signatures[s]='pending';let decodes=0;
 await scan(cp,async(method,params)=>{if(method==='getTransaction'){decodes++;return tx(params[0]);}return [];});
 const original=structuredClone(cp.networkEvidence);cp=JSON.parse(JSON.stringify(cp));
 await scan(cp,async(method)=>{assert.notEqual(method,'getTransaction');return [];});
 assert.equal(decodes,1);assert.deepEqual(cp.networkEvidence,original);assert.equal(cp.edges[a+'|'+b].signatures.length,1);
});
test('null prefix cannot starve later pending signatures across JSON resumes',async()=>{
 let cp=fixture();for(let i=1;i<=5;i++)cp.signatures[signature(i)]='pending';for(const w of Object.values(cp.wallets))w.exhausted=true;
 const seen=[];
 for(let i=0;i<3;i++){await scan(cp,async(method,params)=>{seen.push(params[0]);return params[0]===signature(5)?tx(params[0]):null;},{maxRequests:2});cp=JSON.parse(JSON.stringify(cp));}
 assert.deepEqual(seen.slice(0,5),[1,2,3,4,5].map(signature));assert.equal(cp.signatures[signature(5)],'checked');assert.equal(cp.signatures[signature(1)],'pending');
});
test('a pending signature is attempted at most once per batch even after new pages',async()=>{
 const cp=fixture();cp.signatures[signature(1)]='pending';const counts=new Map();
 await scan(cp,async(method,params)=>{if(method==='getTransaction'){counts.set(params[0],(counts.get(params[0])||0)+1);return null;}return [entry(2)];},{maxRequests:8});
 assert.equal(counts.get(signature(1)),1);assert.equal(counts.get(signature(2)),1);
});
test('one-request batches alternate decoding and wallet discovery without increasing budget',async()=>{
 let cp=fixture();cp.signatures[signature(1)]='pending';const calls=[];
 for(let i=0;i<4;i++){const r=await scan(cp,async(method,params)=>{calls.push([method,params[0]]);return method==='getTransaction'?null:[];},{maxRequests:1});assert.equal(r.summary.requestCount,1);cp=JSON.parse(JSON.stringify(cp));}
 assert.deepEqual(calls.map(([m])=>m),['getTransaction','getSignaturesForAddress','getTransaction','getSignaturesForAddress']);assert.deepEqual(calls.filter(([m])=>m==='getSignaturesForAddress').map(([,w])=>w),[a,b]);
});
test('provider failure preserves wallet cursor and history but rotates decode retry',async()=>{
 let cp=fixture();cp.signatures[signature(1)]='pending';cp.signatures[signature(2)]='pending';const before=structuredClone(cp.wallets);
 const first=await scan(cp,async()=>{throw Error('FIXTURE_PROVIDER_FAILURE');});assert.equal(first.summary.reason,'FIXTURE_PROVIDER_FAILURE');assert.deepEqual(cp.wallets,before);
 cp=JSON.parse(JSON.stringify(cp));const seen=[];await scan(cp,async(method,params)=>{seen.push(params[0]);return tx(params[0]);},{maxRequests:1});assert.equal(seen[0],signature(2));assert.equal(cp.signatures[signature(1)],'pending');
});
test('later page failure preserves earlier progress and resumes only the failing wallet',async()=>{
 let cp=fixture();let calls=0;
 const first=await scan(cp,async()=>{calls++;if(calls===2)throw Error('FIXTURE_PAGE_FAILURE');return [];},{maxRequests:2});
 assert.equal(first.summary.reason,'FIXTURE_PAGE_FAILURE');assert.equal(cp.wallets[a].exhausted,true);assert.equal(cp.wallets[b].pages,0);assert.equal(cp.nextWalletIndex,1);
 cp=JSON.parse(JSON.stringify(cp));const seen=[];await scan(cp,async(method,params)=>{seen.push(params[0]);return [];},{maxRequests:1});assert.deepEqual(seen,[b]);
});
for(const failure of ['identity','retention','state'])test('network '+failure+' cannot mark newly fetched transaction checked',async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';cp.networkEvidence={version:1,snapshotIdentity:holderNetworkSnapshotIdentity(cp),processed:{},transfers:[],retentionLimited:false};
 if(failure==='identity')cp.networkEvidence.snapshotIdentity='wrong';
 if(failure==='retention')cp.networkEvidence.retentionLimited=true;
 if(failure==='state')cp.networkEvidence.processed[s]={valid:true,transferCount:0};
 const before=structuredClone(cp.networkEvidence),r=await scan(cp,async()=>tx(s),{maxRequests:1});
 assert.match(r.summary.reason,/NETWORK_/);assert.equal(cp.signatures[s],'pending');assert.deepEqual(cp.networkEvidence,before);assert.deepEqual(cp.edges,{});
});

test('unsupported returned transaction version cannot advance a pending signature',async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';const r=await scan(cp,async()=>({...tx(s),version:9}),{maxRequests:1});
 assert.equal(cp.signatures[s],'pending');assert.equal(r.summary.decodeUnverified,1);assert.equal(cp.networkEvidence,undefined);
});
test('retention overflow preserves prior evidence without marking the transaction checked',async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';cp.networkEvidence={version:1,snapshotIdentity:holderNetworkSnapshotIdentity(cp),processed:{},transfers:Array.from({length:20000},()=>({signature:'prior',amountRaw:'1'})),retentionLimited:false};
 const prior=structuredClone(cp.networkEvidence),r=await scan(cp,async()=>tx(s),{maxRequests:1});
 assert.equal(r.summary.reason,'NETWORK_RETENTION_LIMIT');assert.equal(cp.signatures[s],'pending');assert.deepEqual(cp.networkEvidence,prior);assert.deepEqual(cp.edges,{});
});
test('inspected transaction with unresolved instructions remains observed-only',async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';const transaction=tx(s);transaction.transaction.message.instructions=[{programId:'11111111111111111111111111111111',data:'unparsed'}];
 const r=await scan(cp,async()=>transaction,{maxRequests:1});
 assert.equal(r.summary.decodeUnresolved,1);assert.equal(cp.networkEvidence.processed[s].unresolvedTokenTransfers,1);assert.deepEqual(cp.networkEvidence.transfers,[]);assert.equal(r.summary.archiveCompletenessProven,false);
});
test('malformed nested transaction arrays do not partially mark checked or create edges',async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';const transaction=tx(s);transaction.meta.preTokenBalances={malformed:true};
 const r=await scan(cp,async()=>transaction,{maxRequests:1});assert.equal(cp.signatures[s],'pending');assert.equal(cp.networkEvidence,undefined);assert.deepEqual(cp.edges,{});assert.equal(r.summary.decodeSuccesses,0);
});

test('first oversized transaction cannot silently fill then truncate a new evidence ledger',async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';const transaction=tx(s),ix=transaction.transaction.message.instructions[0];
 transaction.transaction.message.instructions=Array.from({length:20001},(_,i)=>({...ix,parsed:{...ix.parsed,info:{...ix.parsed.info,lamports:i+1}}}));
 const r=await scan(cp,async()=>transaction,{maxRequests:1});assert.equal(r.summary.reason,'NETWORK_RETENTION_LIMIT');assert.equal(cp.signatures[s],'pending');assert.equal(cp.networkEvidence,undefined);assert.deepEqual(cp.edges,{});
});
for(const malformed of [null,[],{},'invalid'])test('malformed instruction cannot masquerade as an empty decoded transaction '+JSON.stringify(malformed),async()=>{
 const cp=fixture(),s=signature(1);cp.signatures[s]='pending';const transaction=tx(s);transaction.transaction.message.instructions=[malformed];
 const r=await scan(cp,async()=>transaction,{maxRequests:1});assert.equal(r.summary.decodeUnverified,1);assert.equal(cp.signatures[s],'pending');assert.equal(cp.networkEvidence,undefined);
});

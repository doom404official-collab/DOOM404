import test from 'node:test';
import assert from 'node:assert/strict';
import {createHolderHistoryCheckpoint,recordHistoryPage,HOLDER_PAGE_REPLAY_WINDOW} from '../lib/holderHistoryCheckpoint.mjs';
import {scanHolderHistoryBatch} from '../lib/holderHistoryEngine.mjs';
import {holderScanCoverage} from '../lib/holderRoundRobin.mjs';
const cp=()=>createHolderHistoryCheckpoint({mint:'fixture',holders:[{ownerWallet:'wallet-a',sharePct:1},{ownerWallet:'wallet-b',sharePct:1}]});
const page=(wallet,cursor)=>({wallet,signatures:[],entriesSeen:1,nextCursor:cursor,oldestSlot:100,providerPageExhausted:false});
test('same-slot A to B to A provider cycle stops across persisted resumes',async()=>{
 let state=cp();state.wallets['wallet-a'].cursor='A';state.wallets['wallet-a'].oldestSlot=100;state.wallets['wallet-b'].exhausted=true;
 // Failed transactions still set raw page boundaries without decode requests.
 const scan=cursor=>scanHolderHistoryBatch({checkpoint:state,maxRequests:1,pageLimit:1,rpc:async(method)=>{
  assert.equal(method,'getSignaturesForAddress');return [{signature:cursor,slot:100,err:'FixtureFailure'}];
 }});
 assert.equal((await scan('B')).summary.reason,null);
 state=JSON.parse(JSON.stringify(state));assert.deepEqual(state.wallets['wallet-a'].pageReplay.cursors,['A','B']);
 const before=structuredClone(state);const result=await scan('A');
 assert.equal(result.summary.reason,'PAGINATION_REPLAY_DETECTED');assert.equal(result.summary.requestCount,1);
 const expected=structuredClone(before);expected.wallets['wallet-a'].pageReplay.stalledCursor='A';assert.deepEqual(state,expected);
 state=JSON.parse(JSON.stringify(state));const resumed=await scan('A');assert.equal(resumed.summary.reason,'PAGINATION_REPLAY_REVIEW_REQUIRED');assert.equal(resumed.summary.requestCount,0);assert.deepEqual(state,expected);assert.equal(resumed.summary.scanCoverage.perWallet[0].pageReplayStalled,true);
});
test('same-slot distinct cursors and cross-wallet shared signatures remain allowed',()=>{
 const state=cp();for(const wallet of ['wallet-a','wallet-b'])for(const cursor of ['A','B','C'])recordHistoryPage(state,{wallet,page:{...page(wallet,cursor),signatures:[cursor]}});
 assert.deepEqual(state.wallets['wallet-a'].pageReplay.cursors,['A','B','C']);assert.deepEqual(state.wallets['wallet-b'].pageReplay.cursors,['A','B','C']);assert.equal(Object.keys(state.signatures).length,3);
});
test('legacy missing replay history is unverified, never reconstructed from global signatures',()=>{
 const state=cp();state.signatures.A='checked';state.wallets['wallet-a'].cursor='legacy-boundary';
 const before=structuredClone(state);assert.equal(holderScanCoverage(state).perWallet[0].pageReplayCoverage,'legacy_unverified');assert.deepEqual(state,before);
 recordHistoryPage(state,{wallet:'wallet-a',page:page('wallet-a','A')});
 assert.deepEqual(state.wallets['wallet-a'].pageReplay.cursors,['legacy-boundary','A']);assert.equal(state.signatures.A,'checked');assert.equal(state.wallets['wallet-a'].pageReplay.priorHistoryVerified,false);assert.equal(holderScanCoverage(state).perWallet[0].pageReplayHistoryVerified,false);
});
test('window is bounded without deleting signatures, evidence or older cursor coverage claims',()=>{
 const state=cp();state.networkEvidence={retained:'unchanged'};
 for(let i=0;i<HOLDER_PAGE_REPLAY_WINDOW+5;i++)recordHistoryPage(state,{wallet:'wallet-a',page:{...page('wallet-a','cursor-'+i),signatures:['signature-'+i]}});
 assert.equal(state.wallets['wallet-a'].pageReplay.cursors.length,HOLDER_PAGE_REPLAY_WINDOW);assert.equal(state.wallets['wallet-a'].pageReplay.cursors[0],'cursor-5');assert.equal(Object.keys(state.signatures).length,21);assert.deepEqual(state.networkEvidence,{retained:'unchanged'});
 const coverage=holderScanCoverage(state).perWallet[0];assert.equal(coverage.pageReplayCoverage,'bounded_recent_cursors_only');assert.equal(coverage.pageReplayHistoryVerified,false);
 // Outside-window history is explicitly unverified; do not fabricate detection.
 recordHistoryPage(state,{wallet:'wallet-a',page:page('wallet-a','cursor-0')});assert.equal(state.wallets['wallet-a'].pageReplay.priorHistoryVerified,false);
});
test('empty page does not falsely count the unchanged terminal boundary as replay',()=>{
 const state=cp();recordHistoryPage(state,{wallet:'wallet-a',page:page('wallet-a','A')});const replay=structuredClone(state.wallets['wallet-a'].pageReplay);
 recordHistoryPage(state,{wallet:'wallet-a',page:{...page('wallet-a','A'),entriesSeen:0,providerPageExhausted:true}});
 assert.deepEqual(state.wallets['wallet-a'].pageReplay,replay);assert.equal(state.wallets['wallet-a'].cursor,'A');assert.equal(state.wallets['wallet-a'].exhausted,true);
});
for(const replay of [null,{version:2,cursors:['A'],priorHistoryVerified:false},{version:1,cursors:['A','A'],priorHistoryVerified:false},{version:1,cursors:['wrong'],priorHistoryVerified:false},{version:1,cursors:['A'],priorHistoryVerified:true},{version:1,cursors:Array(17).fill('A'),priorHistoryVerified:false}])test('malformed persisted replay metadata fails without reset',()=>{
 const state=cp();state.wallets['wallet-a'].cursor='A';state.wallets['wallet-a'].pageReplay=replay;const before=structuredClone(state);
 assert.throws(()=>recordHistoryPage(state,{wallet:'wallet-a',page:page('wallet-a','B')}),/INVALID_PAGE_REPLAY_WINDOW/);assert.deepEqual(state,before);
});

test('replayed page cannot enqueue signatures or advance history counters',()=>{
 const state=cp();recordHistoryPage(state,{wallet:'wallet-a',page:page('wallet-a','A')});recordHistoryPage(state,{wallet:'wallet-a',page:page('wallet-a','B')});const before=structuredClone(state);
 assert.throws(()=>recordHistoryPage(state,{wallet:'wallet-a',page:{...page('wallet-a','A'),signatures:['must-not-enqueue']}}),/PAGINATION_REPLAY_DETECTED/);
 const expected=structuredClone(before);expected.wallets['wallet-a'].pageReplay.stalledCursor='A';assert.deepEqual(state,expected);
 assert.throws(()=>recordHistoryPage(state,{wallet:'wallet-a',page:page('wallet-a','C')}),/PAGINATION_REPLAY_REVIEW_REQUIRED/);assert.deepEqual(state,expected);
});
test('legacy empty response leaves missing replay history explicitly unverified',()=>{
 const state=cp();recordHistoryPage(state,{wallet:'wallet-a',page:{...page('wallet-a',null),entriesSeen:0,providerPageExhausted:true}});
 assert.equal(Object.hasOwn(state.wallets['wallet-a'],'pageReplay'),false);assert.equal(holderScanCoverage(state).perWallet[0].pageReplayCoverage,'legacy_unverified');assert.equal(holderScanCoverage(state).perWallet[0].pageReplayHistoryVerified,false);
});

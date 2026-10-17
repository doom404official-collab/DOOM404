import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
async function scenario(state){
 let saved;
 state={originEvidence:[{creator,signature:'1'.repeat(88)}],...state};
 const store={async get(){return {status:'partial',stage:'selling',state}},async claim(){return true},async save(v){saved=v}};
 const outcome=await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com',fetchImpl:async()=>({ok:true,status:200,json:async()=>({result:[]})})});
 return {outcome,saved};
}
const incomplete=await scenario({launchTimestamp:1700000000,initialAttributableRaw:'1000',verifiedSwapSales:[{signature:'sale',kind:'VERIFIED_SWAP_SELL',independentlyVerified:true,inputMintVerified:true,timestamp:1700000100,soldRaw:'100'}]});
assert.equal(incomplete.saved.stage,'selling');
assert.equal(incomplete.saved.state.selling.windows[0].sellThroughPct,null);
assert.equal(incomplete.saved.state.sellingStatus,'HISTORICAL_COVERAGE_INCOMPLETE');
assert.equal(incomplete.saved.requestCount,1);
assert.deepEqual(incomplete.saved.state.creatorProcessedSignatures,[]);
assert.deepEqual(incomplete.saved.state.creatorPendingSignatures,[]);
assert.equal(incomplete.saved.state.creatorSwapVerificationComplete,false);
assert.equal(incomplete.saved.state.creatorHistoryComplete,false);
const missing=await scenario({});
assert.equal(missing.saved.stage,'selling');
assert.equal(missing.saved.state.sellingStatus,'AWAITING_VERIFIED_INITIAL_ALLOCATION_AND_LAUNCH_TIME');
const complete=await scenario({launchTimestamp:1700000000,initialAttributableRaw:'1000',verifiedSwapSales:[],historyCompleteByWindow:{3600:true,86400:true,604800:true}});
assert.equal(complete.saved.stage,'previous_launches');
assert.equal(complete.saved.state.selling.windows[0].sellThroughPct,0);
console.log('creator selling tick tests passed');

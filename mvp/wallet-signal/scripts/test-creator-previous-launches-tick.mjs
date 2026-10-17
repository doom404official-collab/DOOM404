import assert from 'node:assert/strict';
import {runCreatorIntelligenceTick} from '../lib/creatorIntelligenceTick.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
async function run(launches){
 let saved;
 const store={async get(){return {status:'partial',stage:'previous_launches',state:{originEvidence:[{creator,signature:'1'.repeat(88)}],historicalLaunchEvidence:launches}}},async claim(){return true},async save(v){saved=v}};
 await runCreatorIntelligenceTick({mint,store,rpcUrl:'https://example.com'});
 return saved;
}
const unknown=await run([]);
assert.equal(unknown.stage,'previous_launches');
assert.equal(unknown.status,'partial');
assert.equal(unknown.state.previousLaunches.noPriorLaunchesVerified,false);
assert.equal(unknown.state.previousLaunchesStatus,'HISTORICAL_COVERAGE_INCOMPLETE');
const verified=await run([{mint:'another-mint',launchCreator:creator,creationInstructionVerified:true,creationSignature:'sig',decoderVersion:'pump-v1',observationWindowComplete:true,earlySellingVerified:true,earlySellingObserved:false,liquidityWithdrawalVerified:true,liquidityWithdrawalObserved:false}]);
assert.equal(verified.state.previousLaunches.attributedLaunchCount,1);
assert.equal(verified.state.previousLaunchesStatus,'EVIDENCE_READY');
assert.equal(verified.status,'partial','stage readiness must not mark full creator investigation complete');
console.log('creator previous launches tick tests passed');

import assert from 'node:assert/strict';
import {collectCreatorLaunchCandidates} from '../lib/creatorHistoricalLaunchDiscovery.mjs';
const creator='6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';
const result=collectCreatorLaunchCandidates({creator,observations:[
 {mint,creator,role:'launchpad_creator',signature:'sig1',creationInstructionVerified:false},
 {mint,creator,role:'launchpad_creator',signature:'sig2',creationInstructionVerified:true,decoderVersion:'pump-v1'},
 {mint,creator:'other',role:'launchpad_creator',signature:'sig3',creationInstructionVerified:true,decoderVersion:'pump-v1'}
]});
assert.equal(result.candidates.length,1);
assert.equal(result.verifiedCount,1);
assert.equal(result.candidates[0].signature,'sig2');
assert.equal(result.discoveryCoverageComplete,false);
assert.equal(result.noPriorLaunchesVerified,false);
console.log('creator historical launch discovery tests passed');

import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCreatorAcquisitionLedger } from '../lib/creatorAcquisitionLedger.mjs';
const mint='mint',creator='creator';
const base={mint,creator,type:'PURCHASE',signature:'sig',instructionIndex:0,timestamp:1,amountRaw:'100',independentlyVerified:true,instructionVerified:true,settlementVerified:true};
const run=events=>summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:true,attributionComplete:true});
test('valid independently settled purchase is counted once',()=>{
 const result=run([base,{...base}]);
 assert.equal(result.acceptedCount,1);
 assert.equal(result.purchasedRaw,'100');
 assert.equal(result.scoreEligible,true);
});
test('unsettled purchase stays rejected with precise diagnostic',()=>{
 const result=run([{...base,settlementVerified:false}]);
 assert.equal(result.acceptedCount,0);
 assert.equal(result.purchasedRaw,'0');
 assert.equal(result.rejected[0].reason,'INSUFFICIENT_EVIDENCE');
 assert.equal(result.rejected[0].detail,'SETTLEMENT_VERIFICATION_MISSING');
 assert.equal(result.scoreEligible,false);
});
test('unverified instruction and creator mismatch remain rejected',()=>{
 const result=run([{...base,instructionVerified:false},{...base,signature:'other',creator:'wrong'}]);
 assert.deepEqual(result.rejected.map(x=>x.detail).sort(),['ATTRIBUTION_MISMATCH','INSTRUCTION_VERIFICATION_MISSING']);
 assert.equal(result.acceptedCount,0);
});
test('incomplete history cannot become score eligible',()=>{
 const result=summarizeCreatorAcquisitionLedger({mint,creator,events:[base],historyComplete:false,attributionComplete:true});
 assert.equal(result.purchasedRaw,'100');
 assert.equal(result.scoreEligible,false);
});

test('malformed null event fails closed without crashing other evidence',()=>{
 const result=run([null,base]);
 assert.equal(result.acceptedCount,1);
 assert.equal(result.rejected.length,1);
 assert.equal(result.rejected[0].detail,'INVALID_INSTRUCTION_IDENTITY');
 assert.equal(result.scoreEligible,false);
});

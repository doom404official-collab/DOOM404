import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTransferFee,resolveEpochFee,calculateTransferFeeRaw,consistentEpochContext,uint64} from '../lib/tokenTransferFeeEvidence.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
const olderFee={epoch:'10',basisPoints:50,maximumFeeRaw:'18446744073709551615'};
const newerFee={epoch:'20',basisPoints:250,maximumFeeRaw:'9007199254740993'};
test('epoch selection uses older before activation and newer at activation',()=>{
 for(const [epoch,expected] of [['19',50],['20',250],['21',250]])assert.equal(resolveEpochFee({olderFee,newerFee,epoch}).basisPoints,expected);
 assert.equal(resolveEpochFee({olderFee,newerFee,epoch:'9'}),null);
 assert.equal(resolveEpochFee({olderFee,newerFee}),null);
 assert.equal(resolveEpochFee({olderFee:{...olderFee,epoch:'21'},newerFee,epoch:25}),null);
});
test('u64 normalization rejects missing coerced malformed overflowing and already-rounded numbers',()=>{
 for(const value of [undefined,null,true,'','-1','1.1',NaN,Infinity,9007199254740992,'18446744073709551616'])assert.equal(uint64(value),null,String(value));
 assert.equal(uint64('18446744073709551615'),18446744073709551615n);
 for(const value of [undefined,null,false,'',10001])assert.equal(normalizeTransferFee({...olderFee,basisPoints:value}),null);
 assert.equal(normalizeTransferFee({...olderFee,maximumFeeRaw:9007199254740992}),null);
 assert.equal(normalizeTransferFee({...olderFee,epoch:null}),null);
 assert.deepEqual(normalizeTransferFee({epoch:'20',transfer_fee_basis_points:250,maximum_fee:'9007199254740993'}),{...newerFee,percentage:2.5});
});
test('exact gross-amount arithmetic rounds up then caps without Number conversion',()=>{
 assert.equal(calculateTransferFeeRaw(olderFee,'1'),'1');
 assert.equal(calculateTransferFeeRaw(olderFee,'200'),'1');
 assert.equal(calculateTransferFeeRaw(olderFee,'201'),'2');
 assert.equal(calculateTransferFeeRaw({...newerFee,basisPoints:10000},'18446744073709551615'),'9007199254740993');
 assert.equal(calculateTransferFeeRaw({...olderFee,basisPoints:10000},'18446744073709551615'),'18446744073709551615');
 assert.equal(calculateTransferFeeRaw({...olderFee,maximumFeeRaw:'0'},'999'),'0');
 assert.equal(calculateTransferFeeRaw({...olderFee,basisPoints:0},'999'),'0');
 assert.equal(calculateTransferFeeRaw(olderFee,'0'),'0');
 assert.equal(calculateTransferFeeRaw(olderFee,9007199254740992),null);
});
test('cross-epoch and out-of-order RPC observations never resolve a schedule',()=>{
 const first={epoch:20,absoluteSlot:100},last={epoch:20,absoluteSlot:102};
 assert.ok(consistentEpochContext(first,last,101));
 for(const args of [[first,{...last,epoch:21},101],[first,last,99],[first,last,103],[null,last,101],[first,last,undefined]])assert.equal(consistentEpochContext(...args),null);
});
test('dashboard resolves fresh matched schedule but leaves transfer behavior scoring pending',()=>{
 const observedAt='2026-10-20T06:00:00Z';
 const extensions={mint:'mint',verified:true,observedAt,epochContext:{epoch:'20',beforeSlot:'100',accountSlot:'101',afterSlot:'102',commitment:'confirmed'},transferFee:{status:'observed',olderFee,newerFee,configAuthorityReported:true,configAuthority:null}};
 const args={result:{mint:'mint',tokenProgram:'spl-token-2022',mintAuthority:null,freezeAuthority:null},extensions,now:Date.parse(observedAt)};
 const out=adaptDashboardEvidence(args);
 assert.equal(out.effectiveFee.basisPoints,250);
 assert.equal(out.effectiveFee.maximumFeeRaw,'9007199254740993');
 assert.equal(out.scores.token_security.components[0].points,null);
 assert.equal(out.scores.token_security.calibrated,false);
 for(const patch of [{mint:'other'},{verified:false},{observedAt:null},{observedAt:'2026-10-19T00:00:00Z'},{observedAt:'2026-10-20T07:00:00Z'},{epochContext:null}])assert.equal(adaptDashboardEvidence({...args,extensions:{...extensions,...patch}}).effectiveFee,null);
 const noFee={...extensions,transferFee:{status:'not_observed'}};
 assert.equal(adaptDashboardEvidence({...args,extensions:noFee}).scores.token_security.components[0].reason,'not_applicable');
 for(const observedAt of [null,'2026-10-19T00:00:00Z'])assert.notEqual(adaptDashboardEvidence({...args,extensions:{...noFee,observedAt}}).scores.token_security.components[0].reason,'not_applicable');
});

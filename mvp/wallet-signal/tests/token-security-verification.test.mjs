import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreTokenSecurity as score} from '../lib/glitchAttributeEnginesV11.mjs';
import {scoreTokenSecurity as baseline} from './fixtures/token-security/baseline.mjs';
const active='11111111111111111111111111111111';
const valid={tokenProgram:'token-2022',authoritiesParsed:true,mintAuthority:null,freezeAuthority:null,feeExtensionVerified:true,feeApplicable:true,feePercent:0,feeConfigAuthorityReported:true,feeConfigAuthority:null};
const malformed=[undefined,null,false,'false','true',0,1,{},[],new Boolean(true)];
for(const flag of ['authoritiesParsed','feeExtensionVerified','feeConfigAuthorityReported']) {
 test(`${flag} requires actual true`,()=>{
  for(const value of malformed) {
   const input={...valid,[flag]:value,...(flag==='feeExtensionVerified'?{feeApplicable:false,feePercent:undefined}:{})};
   const out=score(input);
   assert.equal(out.score,null);
   assert.equal(out.complete,false);
   if(flag==='authoritiesParsed')assert.deepEqual(out.components.slice(2).map(c=>c.points),[null,null]);
   if(flag==='feeExtensionVerified')assert.deepEqual(out.components.slice(0,2).map(c=>c.max),[25,25]);
   if(flag==='feeConfigAuthorityReported')assert.equal(out.components[1].points,null);
  }
 });
}
test('SPL synthetic engine reproduction: malformed parsed flags cannot yield 100',()=>{
 for(const authoritiesParsed of malformed) {
  const out=score({...valid,tokenProgram:'spl-token',authoritiesParsed});
  assert.equal(out.score,null);
  assert.equal(out.coveragePct,0);
 }
 assert.equal(score({...valid,tokenProgram:'spl-token'}).score,100);
});
test('verified positive controls retain fee applicability and authority points',()=>{
 assert.equal(score(valid).score,100);
 assert.equal(score({...valid,feeApplicable:false}).score,100);
 assert.equal(score({...valid,mintAuthority:active,freezeAuthority:active,feeConfigAuthority:active}).score,25);
 assert.equal(score({...valid,feeApplicable:'false',feePercent:undefined}).score,null);
});
test('valid boolean inputs match frozen assessment output across every fee threshold (6,912 cases)',()=>{
 let count=0;
 for(const tokenProgram of ['spl-token','token-2022'])
 for(const authoritiesParsed of [false,true])
 for(const feeExtensionVerified of [false,true])
 for(const feeConfigAuthorityReported of [false,true])
 for(const feeApplicable of [undefined,false,true])
 for(const mintAuthority of [null,active])
 for(const freezeAuthority of [null,active])
 for(const feeConfigAuthority of [null,active])
 for(const feePercent of [undefined,0,0.01,1,1.01,3,3.01,5,5.01,100,-1,101,NaN,Infinity,'0',null,0.99,4.99]) {
  const input={tokenProgram,authoritiesParsed,feeExtensionVerified,feeConfigAuthorityReported,feeApplicable,mintAuthority,freezeAuthority,feeConfigAuthority,feePercent};
  assert.deepEqual(score(input),baseline(input));count++;
 }
 assert.equal(count,6912);
});

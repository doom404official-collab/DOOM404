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
test('verified valid inputs match frozen assessment output across every fee threshold (2,880 cases)',()=>{
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
  if(tokenProgram==='spl-token'?!authoritiesParsed:!feeExtensionVerified||typeof feeApplicable!=='boolean')continue;
  const input={tokenProgram,authoritiesParsed,feeExtensionVerified,feeConfigAuthorityReported,feeApplicable,mintAuthority,freezeAuthority,feeConfigAuthority,feePercent};
  assert.deepEqual(score(input),baseline(input));count++;
 }
 assert.equal(count,2880);
});
test('verified flags do not turn malformed or absent authorities into revoked points',()=>{
 for(const field of ['mintAuthority','freezeAuthority','feeConfigAuthority'])for(const value of [undefined,'',false,true,0,1,{},[],'invalid-key']){
  const out=score({...valid,[field]:value});
  assert.equal(out.score,null,field+' '+String(value));
  const id={mintAuthority:'mint_authority',freezeAuthority:'freeze_authority',feeConfigAuthority:'fee_configuration_authority'}[field];
  assert.equal(out.components.find(c=>c.id===id).points,null);
 }
});
test('unverified or unknown-program fees cannot earn points or a final score',()=>{
 for(const feeExtensionVerified of malformed)for(const feePercent of [0,1,3,5,100]){
  const out=score({...valid,feeExtensionVerified,feePercent});assert.deepEqual(out.components.slice(0,2).map(x=>x.points),[null,null]);assert.equal(out.score,null);
 }
 for(const tokenProgram of [undefined,null,'unknown','SPL-TOKEN',{},true]){
  const out=score({...valid,tokenProgram});assert.deepEqual(out.components.slice(0,2).map(x=>[x.max,x.points]),[[25,null],[25,null]]);assert.equal(out.score,null);
 }
 for(const feeApplicable of [undefined,null,'true','false',1,{}])assert.equal(score({...valid,feeApplicable}).components[0].points,null);
});
test('malformed fee numbers remain Unknown, while verified zero and upper bound keep policy',()=>{
 for(const feePercent of [-1,NaN,Infinity,-Infinity,'0',null,undefined,101])assert.equal(score({...valid,feePercent}).components[0].points,null);
 assert.equal(score({...valid,feePercent:0}).components[0].points,25);assert.equal(score({...valid,feePercent:100}).components[0].points,0);
 for(const authoritiesParsed of malformed){const out=score({...valid,tokenProgram:'spl-token',authoritiesParsed});assert.deepEqual(out.components.slice(0,2).map(x=>x.max),[25,25]);}
});

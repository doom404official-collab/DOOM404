import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mintAuthorityEvidence} from '../lib/mintAuthorityEvidence.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
import {assessTokenControls} from '../lib/tokenControlsDisplayV11.mjs';
const mint='So11111111111111111111111111111111111111112';
const active='11111111111111111111111111111111';
const consumers=[r=>adaptDashboardEvidence({result:r}).scores.token_security,r=>assessTokenControls({result:r})];
const result=fields=>({mint,tokenProgram:'spl-token',authorityDetailsStatus:'available',...fields});
const authorityParts=a=>a.components.filter(c=>['mint_authority','freeze_authority'].includes(c.id));
for(const field of ['mintAuthority','freezeAuthority']) {
 for(const [label,value] of [['missing',undefined],['undefined',undefined],['empty',''],['false',false],['number',0],['invalid key','invalid-key'],['object',{}]]) {
  test(`${field}: ${label} remains unknown through producer and both consumers`,()=>{
   const info={mintAuthority:null,freezeAuthority:null};
   if(label==='missing')delete info[field];else info[field]=value;
   const produced=mintAuthorityEvidence(info,{parsed:true});
   assert.equal(produced[field],undefined);
   assert.equal(produced.authorityDetailsStatus,'not_parsed');
   // JSON transport must not manufacture null for absent/invalid evidence.
   assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(produced)),field),false);
   for(const consume of consumers)for(const payload of [result(info),result(JSON.parse(JSON.stringify(produced)))]) {
    const assessment=consume(payload);
    assert.equal(authorityParts(assessment).find(c=>c.id===field.replace('Authority','_authority')).points,null);
    assert.equal(assessment.complete,false);
   }
  });
 }
}
test('explicit null revocation and valid active keys preserve agreed points',()=>{
 for(const [value,points] of [[null,25],[active,0]]) {
  const produced=mintAuthorityEvidence({mintAuthority:value,freezeAuthority:value},{parsed:true});
  assert.equal(produced.authorityDetailsStatus,'available');
  for(const consume of consumers) {
   const assessment=consume(result(produced));
   assert.deepEqual(authorityParts(assessment).map(c=>[c.max,c.points]),[[25,points],[25,points]]);
   assert.equal(assessment.complete,true);
   assert.equal(assessment.calibrated,false);
  }
 }
});
test('unparsed producer cannot claim authority evidence even with explicit nulls',()=>{
 const produced=mintAuthorityEvidence({mintAuthority:null,freezeAuthority:null});
 assert.equal(produced.authorityDetailsStatus,'not_parsed');
 for(const consume of consumers)assert.equal(consume(result(produced)).complete,false);
});
test('creator response uses shared producer without null-coalescing missing authority fields',()=>{
 const route=readFileSync(new URL('../app/api/creator/route.js',import.meta.url),'utf8');
 assert.match(route,/\.\.\.mintAuthorityEvidence\(info,\{parsed:parsedMintDetailsAvailable\}\)/);
 assert.doesNotMatch(route,/mintAuthority: info\.mintAuthority \?\? null|freezeAuthority: info\.freezeAuthority \?\? null/);
});

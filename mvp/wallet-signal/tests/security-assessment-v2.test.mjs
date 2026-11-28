import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessSecurityV2} from '../lib/securityAssessmentV2.mjs';
import {projectSecurityConfiguration} from '../lib/securityConfigurationV2.mjs';
import {decodeToken2022BinaryMint} from '../lib/token2022BinaryMint.mjs';
const mint='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',now=Date.now();
const base={mintAuthority:null,freezeAuthority:null,isInitialized:true,extensions:[]};
function args(info=base){return {tokenProgram:'spl-token-2022',authoritiesParsed:true,mintAuthority:null,freezeAuthority:null,extensions:{verified:true,observedAt:new Date(now).toISOString(),configuration:projectSecurityConfiguration(info,{slot:1}),transferFee:{status:'not_observed'}},now};}
test('authority and transfer control risks reduce score monotonically without fraud assertion',()=>{
 assert.equal(assessSecurityV2(args()).score,100);
 const active=assessSecurityV2(args({...base,mintAuthority:mint,freezeAuthority:mint}));assert.equal(active.score,35);assert.equal(active.coveragePct,100);assert.ok(active.flags.every(f=>!f.detail.includes('is malicious')));
 for(const extension of [{extension:'permanentDelegate',state:{delegate:mint}},{extension:'transferHook',state:{authority:null,programId:mint}},{extension:'pausableConfig',state:{authority:mint,paused:false}},{extension:'nonTransferable',state:{}},{extension:'defaultAccountState',state:{state:'frozen'}}]){
  const score=assessSecurityV2(args({...base,extensions:[extension]}));assert.ok(score.riskScore>=35);assert.equal(score.flags[0].severity,'critical');
 }
});
test('unknown configurations and stale evidence never receive absence points',()=>{
 const a=args({...base,extensions:[{extension:'futureControl'}]});assert.equal(assessSecurityV2(a).coveragePct,30);
 a.extensions.observedAt='2000-01-01';assert.equal(assessSecurityV2(a).coveragePct,30);
 assert.equal(assessSecurityV2({tokenProgram:'unknown'}).score,0);
});
test('live retained authority calibration distinguishes control risk, not legitimacy',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('../docs/token-security-live-calibration-474051450.json',import.meta.url)));
 const outputs=f.response.value.map((a,i)=>{
  if(i===2)return assessSecurityV2(args(decodeToken2022BinaryMint(a,f.addresses[i]).data.parsed.info)).score;
  const b=Buffer.from(a.data[0],'base64');return assessSecurityV2({tokenProgram:'spl-token',authoritiesParsed:true,mintAuthority:b.readUInt32LE(0)?mint:null,freezeAuthority:b.readUInt32LE(46)?mint:null}).score;
 });assert.deepEqual(outputs,[35,100,100]);
});
test('binary privileged extension layouts preserve exact controls and reject truncation',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('./fixtures/token-security-474049119.json',import.meta.url))),prefix=Buffer.from(f.value.data[0],'base64').subarray(0,166);
 for(const [type,n] of [[3,32],[6,1],[9,0],[12,32],[14,64],[26,33]]){
  const b=Buffer.alloc(170+n);prefix.copy(b);b.writeUInt16LE(type,166);b.writeUInt16LE(n,168);if(type===6)b[170]=2;
  const a={...f.value,space:b.length,data:[b.toString('base64'),'base64']};assert.ok(decodeToken2022BinaryMint(a,mint));a.space--;assert.equal(decodeToken2022BinaryMint(a,mint),null);
 }
});
test('freeze and transfer-hook powers share one maximum friction charge',()=>{
 const freeze=assessSecurityV2(args({...base,freezeAuthority:mint}));
 const both=assessSecurityV2(args({...base,freezeAuthority:mint,extensions:[{extension:'transferHook',state:{authority:mint,programId:mint}}]}));
 assert.equal(freeze.riskScore,35);assert.equal(both.riskScore,35);assert.equal(both.flags.filter(f=>['freeze_authority_active','transfer_restrictions'].includes(f.id)).length,2);
});
test('malformed permission projections cannot certify absence',()=>{
 const a=args();delete a.extensions.configuration.permissions;
 const r=assessSecurityV2(a);assert.equal(r.coveragePct,30);assert.ok(r.flags.some(f=>f.id==='unverified_extensions'));
});

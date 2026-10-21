import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectCreatorArchiveAccountResponse as inspect} from '../lib/creatorArchiveAccountDiagnostic.mjs';
const slot=442809233,owner='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const header=createHash('sha256').update('account:Global').digest().subarray(0,8);
const response=(bytes=header)=>({result:{context:{slot},value:{owner,data:[bytes.toString('base64'),'base64']}}});
function review(data){
 const result=inspect({data,slot});
 for(const flag of ['accountLayoutValidated','historicalStateVerified','feeRecipientRolesVerified','eligibleForLivePromotion'])assert.equal(result[flag],false);
 return result;
}
test('matching eight-byte header never validates an account layout',()=>{
 const r=review(response());assert.equal(r.accountHeaderMatches,true);assert.equal(r.accountDataBytes,8);
 assert.equal(r.status,'SLOT_MATCHED_ACCOUNT_RESPONSE');
 assert.equal(r.accountDataSha256,createHash('sha256').update(header).digest('hex'));
});
test('extra undecoded bytes do not establish a versioned layout',()=>{
 assert.equal(review(response(Buffer.concat([header,Buffer.alloc(100)]))).accountHeaderMatches,true);
});
test('truncated header fails header match',()=>{
 for(let n=0;n<8;n++)assert.equal(review(response(header.subarray(0,n))).accountHeaderMatches,false);
});
test('wrong owner and wrong discriminator fail header match',()=>{
 const wrongOwner=response();wrongOwner.result.value.owner='11111111111111111111111111111111';
 assert.equal(review(wrongOwner).accountHeaderMatches,false);
 assert.equal(review(response(Buffer.alloc(8))).accountHeaderMatches,false);
});
test('wrong or missing context slot cannot establish archive capability despite matching header',()=>{
 for(const context of [{slot:slot+1},{slot:String(slot)},{}]){
  const data=response();data.result.context=context;const r=review(data);
  assert.equal(r.accountHeaderMatches,true);assert.equal(r.status,'HISTORICAL_CAPABILITY_UNVERIFIED');
 }
});
test('malformed base64 and unsupported data shapes fail closed without throwing',()=>{
 for(const payload of [[header.toString('base64')+'!','base64'],['!!!!','base64'],[123,'base64'],['AA=','base64'],['AB==','base64'],[header.toString('base64'),'base58'],null,{},['AA==','base64','extra']]){
  const data=response();data.result.value.data=payload;const r=review(data);
  assert.equal(r.accountHeaderMatches,false);assert.equal(r.accountDataBytes,null);assert.equal(r.accountDataSha256,null);
 }
});
test('missing response and provider errors cannot validate history or layout',()=>{
 for(const data of [null,undefined,{}, {result:{value:null}}, {error:{code:-1,message:'unsupported'}}]){
  const r=review(data);assert.equal(r.accountHeaderMatches,false);
  assert.notEqual(r.status,'SLOT_MATCHED_ACCOUNT_RESPONSE');
 }
});

test('CLI emits the conservative helper result without real network access',async()=>{
 const {execFileSync}=await import('node:child_process');
 const script=new URL('../scripts/creator-alchemy-archive-capability-probe.mjs',import.meta.url).href;
 for(const ok of [true,false]){
  const source=`process.env.ALCHEMY_RPC_URL='https://offline.invalid';globalThis.fetch=async()=>({ok:${ok},status:503,json:async()=>(${JSON.stringify(response())})});await import(${JSON.stringify(script)});`;
  const r=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8'}));
  assert.equal(r.accountLayoutValidated,false);
  assert.equal(r.accountHeaderMatches,ok);
  for(const flag of ['accountLayoutValidated','historicalStateVerified','feeRecipientRolesVerified','eligibleForLivePromotion'])assert.equal(r[flag],false);
 }
});

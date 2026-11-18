import test from 'node:test';
import assert from 'node:assert/strict';
import {probe,diagnose,mint,creator,signature} from '../scripts/diagnose-solscan-cross-provider.mjs';
test('endpoint probe does not log secrets or provider error bodies',async()=>{
 const r=await probe('/token/meta',{address:mint},{apiKey:'secret-test',fetchImpl:async(url,opts)=>{
  assert.equal(new URL(url).hostname,'pro-api.solscan.io');assert.equal(opts.redirect,'error');
  return {ok:false,status:403,json:async()=>({errors:{message:'secret-test'}})};
 }});
 assert.equal(r.summary.status,'ACCESS_DENIED');assert.ok(!JSON.stringify(r.summary).includes('secret-test'));
});
test('rate-limit status and retry-after are reported without retrying',async()=>{
 let count=0;
 const r=await probe('/transaction/detail',{tx:signature},{apiKey:'test',fetchImpl:async()=>{count++;return {ok:false,status:429,headers:{get:()=> '60'},json:async()=>({})};}});
 assert.equal(count,1);assert.equal(r.summary.retryAfter,60);
});
test('matching labels and parsed transaction do not become independent decoding',async()=>{
 const r=await diagnose({apiKey:'test',rpcUrl:null,fetchImpl:async(url)=>({ok:true,status:200,json:async()=>({success:true,data:url.includes('/token/meta')?{address:mint,creator,create_tx:signature}:{tx_hash:signature,parsed_instructions:[]}})})});
 assert.equal(r.comparison.comparisonStatus,'PROVIDER_AGREEMENT');assert.equal(r.independent.independentlyDecoded,false);
 assert.equal(r.transactionDetailSignatureMatches,true);assert.equal(r.writeAttempted,false);
});
test('diagnostic uses documented transaction actions endpoint',async()=>{
 const paths=[];
 await diagnose({apiKey:'test',rpcUrl:null,fetchImpl:async(url)=>{paths.push(new URL(url).pathname);return {ok:false,status:401,json:async()=>({errors:{code:401,message:'API token is invalid'}})};}});
 assert.deepEqual(paths,['/v2.0/monitor/usage','/v2.0/token/meta','/v2.0/transaction/detail','/v2.0/transaction/actions']);
});
test('sanitized plan restriction stays distinct from invalid credential',async()=>{
 const r=await probe('/token/meta',{address:mint},{apiKey:'test',fetchImpl:async()=>({ok:false,status:401,json:async()=>({errors:{code:401,message:'Upgrade your subscription plan'}})})});
 assert.equal(r.summary.errorClass,'PLAN_OR_PERMISSION_RESTRICTION');
});

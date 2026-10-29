import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as fees from '../lib/tokenTransferFeeEvidence.mjs';
// Execute the actual GET handler with RPC/Next boundaries replaced, never a live RPC.
const source=readFileSync(new URL('../app/api/token-extensions/route.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export const dynamic','const dynamic').replace('export async function GET','async function GET');
function handler(connection){
 class PublicKey { constructor(value){if(typeof value!=='string'||!value.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/))throw Error('invalid');this.value=value;}toBase58(){return this.value;} }
 return new Function('NextResponse','PublicKey','createReliableConnection','normalizeTransferFee','resolveEpochFee','consistentEpochContext',`${source}; return GET;`)({json:(body,options)=>({body,...options})},PublicKey,()=>connection,fees.normalizeTransferFee,fees.resolveEpochFee,fees.consistentEpochContext);
}
const mint='So11111111111111111111111111111111111111112';
const old={epoch:'1',transferFeeBasisPoints:50,maximumFee:'18446744073709551615'}, newer={epoch:'20',transferFeeBasisPoints:200,maximumFee:'9007199254740993'};
function rpc({epochAfter=20,extensions=[{extension:'transferFeeConfig',state:{olderTransferFee:old,newerTransferFee:newer,transferFeeConfigAuthority:null}}],epochFails=false}={}){
 const calls=[];let n=0;
 return {calls,getEpochInfo:async config=>{calls.push(config);if(epochFails)throw Error('unavailable');return {epoch:n++?epochAfter:20,absoluteSlot:n===1?100:102};},getParsedAccountInfo:async(_mint,config)=>{calls.push(config);return {context:{slot:101},value:{data:{program:'spl-token-2022',parsed:{type:'mint',info:{extensions}}}}};}};
}
test('actual API resolves epoch and exact cap, pins slot reads, marks no-store',async()=>{
 const connection=rpc(),out=await handler(connection)(new Request(`https://example.com/api/token-extensions?mint=${mint}`));
 assert.equal(out.body.transferFee.effectiveFee.schedule,'newer');
 assert.equal(out.body.transferFee.effectiveFee.maximumFeeRaw,'9007199254740993');
 assert.equal(out.body.transferFee.configAuthorityReported,true);
 assert.equal(out.headers['Cache-Control'],'no-store');
 assert.equal(connection.calls[1].minContextSlot,100);
 assert.equal(connection.calls[2].minContextSlot,101);
 assert.ok(Number.isFinite(Date.parse(out.body.observedAt)));
});
test('epoch boundary/failure preserves extension evidence but never resolves active fee',async()=>{
 for(const config of [{epochAfter:21},{epochFails:true}]){
  const out=await handler(rpc(config))(new Request(`https://example.com?mint=${mint}`));
  assert.equal(out.body.verified,true);assert.equal(out.body.transferFee.effectiveFee,null);assert.equal(out.body.epochContext,null);
 }
});
test('API distinguishes absent extension, unparsed array and malformed authority',async()=>{
 const request=new Request(`https://example.com?mint=${mint}`);
 assert.equal((await handler(rpc({extensions:[]}))(request)).body.transferFee.status,'not_observed');
 for(const extensions of [null,[null],[{}],[{extension:'transferFeeConfig'},{extension:'transferFeeConfig'}]])assert.equal((await handler(rpc({extensions}))(request)).body.verified,false);
 for(const value of ['',false,123,'malformed']){
  const out=await handler(rpc({extensions:[{extension:'transferFeeConfig',state:{olderTransferFee:old,newerTransferFee:newer,transferFeeConfigAuthority:value}}]}))(request);
  assert.equal(out.body.transferFee.configAuthorityReported,false);
 }
});
test('actual GET through dashboard and compatibility adapters never scores nominal fee evidence',async()=>{
 const {adaptDashboardEvidence}=await import('../lib/glitchDashboardEvidenceV11.mjs');
 const {assessTokenControls}=await import('../lib/tokenControlsDisplayV11.mjs');
 const result={mint,tokenProgram:'spl-token-2022',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null};
 for(const config of [{},{epochAfter:21},{epochFails:true},{extensions:null}]){
  const extensions=(await handler(rpc(config))(new Request(`https://example.com?mint=${mint}`))).body;
  for(const payload of [extensions,JSON.parse(JSON.stringify(extensions))]){
   const dashboard=adaptDashboardEvidence({result,extensions:payload});const compatibility=assessTokenControls({result,extensions:payload});
   assert.equal(dashboard.scores.token_security.components[0].points,null);assert.equal(dashboard.scores.token_security.score,null);assert.equal(compatibility.provisionalScore,null);assert.equal(compatibility.calibrated,false);
  }
 }
 const extensions=(await handler(rpc({extensions:[]}))(new Request(`https://example.com?mint=${mint}`))).body;
 assert.equal(adaptDashboardEvidence({result,extensions}).scores.token_security.components[0].reason,'not_applicable');
 for(const patch of [{verified:'true'},{mint:'foreign'},{observedAt:'2000-01-01T00:00:00Z'}])assert.equal(adaptDashboardEvidence({result,extensions:{...extensions,...patch}}).scores.token_security.score,null);
 assert.equal(adaptDashboardEvidence({result:{...result,tokenProgram:'unknown'},extensions}).scores.token_security.score,null);
});

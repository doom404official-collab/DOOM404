import {projectSecurityConfiguration} from '../lib/securityConfigurationV2.mjs';
import {projectTokenMintControls} from '../lib/tokenMintControls.mjs';
import {decodeToken2022BinaryMint} from '../lib/token2022BinaryMint.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicKey} from '@solana/web3.js';
import {readFileSync} from 'node:fs';
import * as fees from '../lib/tokenTransferFeeEvidence.mjs';
// Execute the actual GET handler with RPC/Next boundaries replaced, never a live RPC.
const source=readFileSync(new URL('../app/api/token-extensions/route.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export const dynamic','const dynamic').replace('export async function GET','async function GET');
function handler(connection){
 return new Function('NextResponse','PublicKey','createReliableConnection','normalizeTransferFee','resolveEpochFee','consistentEpochContext','decodeToken2022BinaryMint','projectTokenMintControls','projectSecurityConfiguration','withProviderUsage',`${source}; return GET;`)({json:(body,options)=>({body,...options})},PublicKey,()=>connection,fees.normalizeTransferFee,fees.resolveEpochFee,fees.consistentEpochContext,decodeToken2022BinaryMint,projectTokenMintControls,projectSecurityConfiguration,(fn,req)=>fn(req));
}
const token2022='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const mint='So11111111111111111111111111111111111111112';
const old={epoch:'1',transferFeeBasisPoints:50,maximumFee:'18446744073709551615'}, newer={epoch:'20',transferFeeBasisPoints:200,maximumFee:'9007199254740993'};
function rpc({owner=new PublicKey(token2022),program='spl-token-2022',type='mint',epochAfter=20,extensions=[{extension:'transferFeeConfig',state:{olderTransferFee:old,newerTransferFee:newer,transferFeeConfigAuthority:null}}],epochFails=false}={}){
 const calls=[];let n=0;
 return {calls,getEpochInfo:async config=>{calls.push(config);if(epochFails)throw Error('unavailable');return {epoch:n++?epochAfter:20,absoluteSlot:n===1?100:102};},getParsedAccountInfo:async(_mint,config)=>{calls.push(config);return {context:{slot:101},value:{owner,data:{program,parsed:{type,info:{extensions}}}}};}};
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

test('producer requires canonical owner independently of parsed program label',async()=>{
 const {adaptDashboardEvidence}=await import('../lib/glitchDashboardEvidenceV11.mjs');
 const request=new Request(`https://example.com?mint=${mint}`);
 const result={mint,tokenProgram:'spl-token-2022',authorityDetailsStatus:'available',mintAuthority:null,freezeAuthority:null};
 const broken=new PublicKey(token2022);broken.toBase58=()=>{throw Error('malformed owner')};
 const rejected=[broken,null,'',false,123,{},[],new Uint8Array(32),{toBase58:()=>token2022},{toString:()=>token2022},
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',mint,' '+token2022,token2022+' ',new PublicKey(mint)];
 for(const owner of rejected)for(const extensions of [[],[{extension:'transferFeeConfig',state:{olderTransferFee:old,newerTransferFee:newer,transferFeeConfigAuthority:null}}]]){
  const out=await handler(rpc({owner,extensions}))(request);
  assert.equal(out.body.verified,false,`owner ${typeof owner}`);
  assert.equal(out.body.transferFee,undefined);
  assert.deepEqual(out.body.extensions,[]);
  const view=adaptDashboardEvidence({result,extensions:out.body});
  assert.equal(view.scores.token_security.score,null);
  assert.equal(view.scores.token_security.components[0].points,null);
  assert.notEqual(view.scores.token_security.components[0].reason,'not_applicable');
 }
 const missing=rpc();const read=missing.getParsedAccountInfo;
 missing.getParsedAccountInfo=async(...args)=>{const r=await read(...args);delete r.value.owner;return r};
 assert.equal((await handler(missing)(request)).body.verified,false);
});
test('canonical string and PublicKey owners retain valid output and label/type guards',async()=>{
 const request=new Request(`https://example.com?mint=${mint}`);
 for(const owner of [token2022,new PublicKey(token2022)]){
  const out=await handler(rpc({owner}))(request);
  assert.equal(out.body.verified,true);
  assert.equal(out.body.transferFee.effectiveFee.maximumFeeRaw,'9007199254740993');
  assert.equal((await handler(rpc({owner,extensions:[]}))(request)).body.transferFee.status,'not_observed');
  for(const patch of [{program:'spl-token'},{program:null},{type:'account'},{type:null}])assert.equal((await handler(rpc({owner,...patch}))(request)).body.verified,false);
 }
});

test('actual API decodes captured binary fallback and rejects incomplete bytes',async()=>{
 const f=JSON.parse(readFileSync(new URL('./fixtures/token2022-observation-20261118.json',import.meta.url)));
 const connection=rpc();connection.getParsedAccountInfo=async()=>({context:{slot:101},value:f.account});
 const request=new Request(`https://example.com?mint=${f.mint}`);
 const out=(await handler(connection)(request)).body;
 assert.equal(out.verified,true);assert.equal(out.encoding,'base64');assert.equal(out.owner,token2022);
 assert.equal(out.transferFee.status,'not_observed');assert.equal(out.transferFee.olderFee,undefined);
 assert.deepEqual(out.extensions.map(x=>x.type),['metadataPointer','tokenMetadata']);
 connection.getParsedAccountInfo=async()=>({context:{slot:101},value:{...f.account,data:Buffer.from(f.account.data[0],'base64')}});
 assert.equal((await handler(connection)(request)).body.transferFee.status,'not_observed');
 connection.getParsedAccountInfo=async()=>({context:{slot:101},value:{...f.account,data:[f.account.data[0].slice(0,-4),'base64']}});
 assert.equal((await handler(connection)(request)).body.verified,false);
});

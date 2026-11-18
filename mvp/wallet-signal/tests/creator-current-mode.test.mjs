import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
const req=createRequire(import.meta.url);
const {transformSync}=req('next/dist/build/swc'),{PublicKey}=req('@solana/web3.js');
const source=fs.readFileSync(new URL('../app/api/creator/route.js',import.meta.url),'utf8');
const {code}=transformSync(source,{filename:'route.js',jsc:{parser:{syntax:'ecmascript'}},module:{type:'commonjs'}});
function harness(){
let release,historyStartedResolve,fetches=0;const calls=[];
const historyStarted=new Promise(r=>historyStartedResolve=r),history=new Promise(r=>release=r);
const owner=new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const connection={getAccountInfo:async()=>{calls.push('account');return {owner};},getParsedAccountInfo:async()=>{calls.push('parsed');return {value:{owner,data:{parsed:{type:'mint',info:{decimals:6,mintAuthority:null,freezeAuthority:null}}}}};},getTokenSupply:async()=>{calls.push('supply');return {value:{decimals:6,uiAmountString:'100'}};},getSignaturesForAddress:()=>{calls.push('history');historyStartedResolve();return history;}};
const modules={'next/server':{NextResponse:{json:(data,options)=>({data,options})}},'@solana/web3.js':{PublicKey},'../../../lib/reliableConnection.js':{createReliableConnection:()=>connection},'../../../lib/mintAuthorityEvidence.mjs':{mintAuthorityEvidence:info=>info},'../../../lib/creatorEvidence.js':{summarizeCreatorEvidence:()=>({status:'unverified'})},'../../../lib/stonkFunEvidence.js':{lookupStonkFun:async()=>({status:'unverified'})}};
for(const [path,name] of [['launchpadEvidence.js','detectLaunchpadEvidence'],['archiveTransaction.js','fetchArchivedTransaction'],['mintInitializationEvidence.js','inspectMintInitialization']])modules['../../../lib/'+path]={[name]:()=>{throw Error('UNEXPECTED_HELPER');}};
modules['../../../lib/creatorOriginResolver.js']={normalizeOriginTransaction:()=>{throw Error('UNEXPECTED_HELPER');},resolveCreatorRole:()=>{throw Error('UNEXPECTED_HELPER');}};
const context={exports:{},require:id=>{assert.ok(Object.hasOwn(modules,id),'unexpected import');return modules[id];},URL,Uint8Array,DataView,Buffer,AbortController,setTimeout,clearTimeout,process:{env:{}},fetch:()=>{fetches++;throw Error('NETWORK_FORBIDDEN');}};
vm.runInNewContext(code,context);
return {GET:context.exports.GET,calls,historyStarted,release,fetches:()=>fetches};
}

const mint='So11111111111111111111111111111111111111112';
const request=query=>({url:'https://fixture.invalid/api/creator?mint='+mint+query});
test('current mode returns validated mint without starting optional history or index calls',async()=>{
 const h=harness();const response=await h.GET(request('&mode=current'));
 assert.deepEqual(h.calls,['account','parsed','supply']);assert.equal(h.fetches(),0);
 assert.equal(response.data.mint,mint);assert.equal(response.data.decimals,6);
 assert.equal(response.data.inspectionMode,'current');assert.equal(response.data.creator.status,'unverified');
 assert.equal(response.data.mintOrigin.coverage.pagesScanned,0);
 assert.equal(response.data.launchInvestigation.creatorVerified,false);
});
test('explicit history mode does not repeat account reads or claim current mint validation',async()=>{
 const h=harness();let returned=false;
 const pending=h.GET(request('&mode=history')).then(r=>{returned=true;return r;});
 await h.historyStarted;await new Promise(r=>setImmediate(r));assert.equal(returned,false);
 assert.deepEqual(h.calls,['history']);h.release([]);const response=await pending;
 assert.equal(response.data.inspectionMode,'history');assert.equal(response.data.currentMintVerified,false);
 assert.equal(response.data.authorityDetailsStatus,'not_parsed');
 const adapted=adaptDashboardEvidence({result:response.data});
 assert.equal(adapted.scores.token_security.coveragePct,0);assert.equal(adapted.scores.token_security.score,null);
 for(const field of ['tokenProgram','mintAuthority','freezeAuthority','decimals','supply'])assert.equal(Object.hasOwn(response.data,field),false);
 assert.equal(h.fetches(),0);
});
test('legacy default remains full inspection; no background history after response',async()=>{
 const h=harness();const pending=h.GET(request(''));await h.historyStarted;
 assert.deepEqual(h.calls,['account','parsed','supply','history']);h.release([]);
 const response=await pending;assert.equal(response.data.decimals,6);assert.equal(response.data.inspectionMode,'full');
});
test('invalid modes and current-mode history parameters reject before any provider method',async()=>{
 for(const query of ['&mode=other','&mode=current&before='+ '2'.repeat(88),'&mode=current&originTx='+'2'.repeat(88)]){
  const h=harness();assert.equal((await h.GET(request(query))).options.status,400);assert.deepEqual(h.calls,[]);assert.equal(h.fetches(),0);
 }
});

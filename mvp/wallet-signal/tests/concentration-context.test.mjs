import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileHolderSnapshot} from '../lib/reconcileHolderSnapshot.mjs';
import {readFileSync} from 'node:fs';
import {hasAlignedConcentrationContext,withConcentrationContext} from '../lib/concentrationContext.mjs';
import {summarizeResolvedTokenAccounts} from '../lib/tokenAccountOwnership.js';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
import {buildDecisionSummary} from '../lib/decisionSummary.js';
import {selectTokenInsights} from '../lib/tokenInsights.js';
import {assessTokenEvidence} from '../lib/tokenAssessmentV11.js';
const mint='7'.repeat(32),now=Date.parse('2026-11-23T10:00:00Z'),updatedAt=new Date(now).toISOString();
const source=readFileSync(new URL('../app/api/token-concentration/route.js',import.meta.url),'utf8');
// Execute the actual route body; substitute imports only, never invoke real RPC.
const buildRoute=new Function('NextResponse','PublicKey','createReliableConnection','summarizeResolvedTokenAccounts','hasAlignedConcentrationContext','withProviderUsage',source.replace(/^import .*;\n/gm,'').replace('export const dynamic','const dynamic').replace('export async function GET','async function GET')+'\nreturn GET;');
async function observe(supply=100,largestSlot,supplySlot){
 if(arguments.length<2)largestSlot=100;if(arguments.length<3)supplySlot=100;
 let calls=0;class PublicKey{constructor(x){this.x=x;}toBase58(){return this.x;}toBytes(){return [];}static isOnCurve(){return true;}}
 const connection={getTokenLargestAccounts:async()=>{calls++;return {context:{slot:largestSlot},value:Array.from({length:20},(_,i)=>({address:new PublicKey('account'+i),amount:'3',uiAmountString:'3'}))};},getTokenSupply:async()=>{calls++;return {context:{slot:supplySlot},value:{amount:String(supply),decimals:0}};},getMultipleParsedAccounts:async keys=>{calls++;return {context:{slot:300},value:keys.map(()=>({data:{parsed:{type:'account',info:{owner:'synthetic-owner'}}}}))};}};
 const get=buildRoute({json:(body,options)=>({body,options})},PublicKey,()=>connection,summarizeResolvedTokenAccounts,hasAlignedConcentrationContext,(fn,req)=>fn(req));
 const response=await get({url:'https://fixture.invalid/api/token-concentration?mint='+mint});assert.equal(calls,3);assert.equal(response.options.headers['Cache-Control'],'no-store');return response.body;
}
const adapt=concentration=>adaptDashboardEvidence({result:{mint},concentration,now});
test('aligned actual route preserves 60/100 formula, raw observations and ownership limitations',async()=>{
 const c=await observe(),h=adapt(c).scores.holder_intelligence;
 assert.equal(c.top20TokenAccountSharePct,60);assert.equal(h.components[0].points,3.5);assert.equal(h.score,null);assert.equal(h.calibrated,false);
 assert.equal(c.accounts[0].sharePct,3);assert.equal(c.ownership.observedOwnerGroups[0].sharePct,60);
 assert.equal(c.ownership.beneficialOwnersVerified,false);assert.equal(c.coverage.isCompleteHolderList,false);assert.equal(withConcentrationContext(c),c);
 const changed=await observe(200,200,200);assert.equal(adapt(changed).scores.holder_intelligence.components[0].points,24.5);
});
for(const [name,a,b] of [['unequal',100,200],['missing-supply',100,undefined],['missing-largest',undefined,100],['string',100,'100'],['fraction',100,100.5],['negative',-1,-1],['unsafe',2**53,2**53],['null',null,null]])test('actual route withholds context-unbound shares: '+name,async()=>{
 const c=await observe(200,a,b);
 assert.equal(hasAlignedConcentrationContext(c),false);
 for(const key of ['largestAccountSharePct','top5TokenAccountSharePct','top10TokenAccountSharePct','top20TokenAccountSharePct'])assert.equal(c[key],null);
 assert.ok(c.accounts.every(x=>x.sharePct===null&&x.amount==='3'&&x.ownerWallet==='synthetic-owner'&&x.accountCategory==='UNCLASSIFIED'));
 assert.equal(c.totalRawSupply,'200');assert.equal(c.ownership.observedOwnerGroups[0].sharePct,null);
 const h=adapt(c).scores.holder_intelligence;assert.equal(h.components[0].points,null);assert.equal(h.coveragePct,0);assert.equal(h.score,null);
});
test('legacy/conflicting response cannot bypass adapter, findings or snapshot admission',async()=>{
 const valid=await observe();const holders=valid.accounts.map(x=>({tokenAccount:x.tokenAccount,ownerWallet:x.ownerWallet,sharePct:x.sharePct}));
 const args={result:{mint},now,historicalHolders:{mint,jobId:'synthetic',updatedAt,holders},verifiedHolderEnvelope:{mint,jobId:'synthetic',updatedAt}};
 assert.equal(adaptDashboardEvidence({...args,concentration:valid}).matchedHolder,true);
 for(const ratioContext of [undefined,{commitment:'confirmed',largestAccountsSlot:100,supplySlot:200},{commitment:'confirmed',largestAccountsSlot:'100',supplySlot:'100'}]){
  const c={...valid,ratioContext},original=JSON.stringify(c),safe=withConcentrationContext(c);
  assert.equal(adaptDashboardEvidence({...args,concentration:c}).matchedHolder,false);assert.equal(adapt(c).top20,undefined);
  assert.ok(!buildDecisionSummary({concentration:c}).findings.some(x=>x.title==='Token-account concentration'));
  assert.ok(!selectTokenInsights({result:{},concentration:c}).some(x=>x.category==='concentration'));
  assert.equal(assessTokenEvidence({concentration:c}).attributes.find(x=>x.id==='concentration').coverage,'missing');
  assert.equal(safe.accounts[0].amount,'3');assert.equal(safe.accounts[0].ownerWallet,'synthetic-owner');assert.equal(safe.accounts[0].sharePct,null);assert.equal(safe.ownership.observedOwnerGroups[0].sharePct,null);assert.equal(JSON.stringify(c),original);
 }
});
test('zero supply is aligned but unscored; grouped unavailable values never coerce to zero',async()=>{
 const zero=await observe(0);assert.equal(hasAlignedConcentrationContext(zero),true);assert.equal(zero.top20TokenAccountSharePct,null);assert.equal(adapt(zero).scores.holder_intelligence.components[0].points,null);
 assert.equal(reconcileHolderSnapshot(zero.accounts,zero.accounts).compatible,false);
 for(const shares of [[null,3],[3,null],[undefined,3],['3',3],[0,0]]){
  const rows=shares.map((sharePct,i)=>({tokenAccount:String(i),sharePct})),parsed=rows.map(()=>({value:{data:{parsed:{type:'account',info:{owner:'same'}}}}}));
  assert.equal(summarizeResolvedTokenAccounts(rows,parsed).observedOwnerGroups[0].sharePct,shares.every(x=>x===0)?0:null);
 }
});
test('page current bridge gates snapshot matching and normalizes response before storage',()=>{
 const page=readFileSync(new URL('../app/page.js',import.meta.url),'utf8');
 assert.match(page,/const holderReconciliation=hasAlignedConcentrationContext\(concentration\)&&holderConnections/);
 assert.match(page,/setConcentration\(withConcentrationContext\(accountData\)\)/);
});
test('snapshot reconciliation rejects unavailable/coerced shares but preserves numeric zero',()=>{
 const holders=Array.from({length:20},(_,i)=>({tokenAccount:'account'+i,ownerWallet:'owner'+i,sharePct:0}));
 assert.equal(reconcileHolderSnapshot(holders,holders).compatible,true);
 for(const sharePct of [null,undefined,false,'','0']){
  assert.equal(reconcileHolderSnapshot(holders.map((h,i)=>i?h:{...h,sharePct}),holders).compatible,false);
 }
});

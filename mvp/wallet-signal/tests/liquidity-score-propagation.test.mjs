import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreLiquidityQuality} from '../lib/glitchAttributeEnginesV11.mjs';
import {consolidate,attributes} from '../lib/glitchScoringV11.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
import {assessCreatorAndLiquidityV11} from '../lib/creatorLiquidityDisplayV11.mjs';
import {summarizeLpHolders} from '../lib/liquidityLpHolderEvidence.mjs';
import {assessPumpAmmWithdrawalRights} from '../lib/pumpAmmWithdrawalEvidence.mjs';
const mint='synthetic',now=1800000000000,stamp=new Date(now).toISOString();
const full={verifiedDepthUsd:250000,verifiedMarketCapUsd:1000000,lpSecurityPoints:25,lpVerified:true,largestIndependentPoolSharePct:40,impactPct:1,impactVerified:true,stabilityPoints:10,stabilityVerified:true};
test('existing formula remains deterministic and uncalibrated even with all synthetic inputs',()=>{
 const a=scoreLiquidityQuality(full),b=scoreLiquidityQuality(Object.fromEntries(Object.entries(full).reverse()));assert.deepEqual(a,b);assert.equal(a.score,100);assert.equal(a.calibrated,false);
 const results=Object.fromEntries(attributes.map(x=>[x.id,{score:100,complete:true,calibrated:true}]));results.liquidity_quality_safety=a;assert.equal(consolidate(results).score,null);
 for(const field of Object.keys(full)){const partial={...full};delete partial[field];assert.equal(scoreLiquidityQuality(partial).score,null,field);}
});
test('incomplete, failed, stale and forged Liquidity evidence cannot fill score components',()=>{
 for(const status of ['partial','failed','unknown','account_checks_completed'])for(const updatedAt of [stamp,new Date(now-3600001).toISOString()]){
  const evidence={mint,status,updatedAt,...full,score:100,finalScore:100,complete:true,calibrated:true};
  const out=adaptDashboardEvidence({result:{mint},liquidity:{...evidence,observedAt:updatedAt,status:'pools_reported',reportedLiquidityUsd:250000},workerEvidence:{version:'1.1',mint,liquidity:evidence},now});
  assert.equal(out.scores.liquidity_quality_safety.score,null);assert.equal(out.scores.liquidity_quality_safety.calibrated,false);assert.ok(out.scores.liquidity_quality_safety.components.every(c=>c.points===null));
  if(status==='failed'||status==='unknown'||updatedAt!==stamp)assert.equal(out.liquidity,null);
  assert.equal(assessCreatorAndLiquidityV11({liquidity:evidence}).consolidated.score,null);
 }
});
test('fresh same-mint estimates remain observed-only; invalid, stale and failed estimates are withheld',()=>{
 const source={mint,observedAt:stamp,status:'pools_reported',reportedLiquidityUsd:100,poolCountReturned:2};
 const adapt=liquidity=>adaptDashboardEvidence({result:{mint},liquidity,now});assert.equal(adapt(source).reportedLiquidity.amount,100);
 for(const patch of [{mint:'other'},{observedAt:new Date(now-3600001).toISOString()},{observedAt:new Date(now+1).toISOString()},{status:'unavailable'},{reportedLiquidityUsd:'100'},{reportedLiquidityUsd:Infinity},{reportedLiquidityUsd:-1}])assert.equal(adapt({...source,...patch}).reportedLiquidity.amount,null);
});
test('enumerated LP inventory below supply never means reconciled supply, custody or scoring evidence',()=>{
 const inventory=summarizeLpHolders([{tokenAccount:'account',owner:'owner',amount:'49'}],'50',true);assert.equal(inventory.inventoryComplete,true);assert.equal(inventory.supplyReconciled,false);
 const rights=assessPumpAmmWithdrawalRights({lpMintEvidence:{mintAccountVerified:true},lpHolderEvidence:inventory});assert.equal(rights.lpHolderInventoryComplete,true);assert.equal(rights.verifiedWithdrawableLpAmount,null);assert.equal(rights.lpCustodyVerified,false);assert.equal(rights.lpSecurityPoints,null);assert.equal(rights.withdrawalRightsVerified,false);
 assert.equal(assessCreatorAndLiquidityV11({liquidity:{...inventory,...rights,...full}}).liquidity.score,null);
});

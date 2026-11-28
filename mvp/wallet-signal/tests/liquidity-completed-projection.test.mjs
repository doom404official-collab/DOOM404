import test from 'node:test';
import assert from 'node:assert/strict';
import {projectLiquidityCheckpoint} from '../lib/dashboardEvidenceBridge.mjs';
import {adaptDashboardEvidence} from '../lib/glitchDashboardEvidenceV11.mjs';
import {scoreLiquidityQuality} from '../lib/glitchAttributeEnginesV11.mjs';
import {consolidate} from '../lib/glitchScoringV11.mjs';
import {persistLiquidityCheckpoint} from '../lib/liquidityCheckpointStore.mjs';
import {appendLiquiditySnapshot} from '../lib/liquiditySnapshotArchive.mjs';
const mint='So11111111111111111111111111111111111111112',time='2026-11-26T06:00:00Z';
const inputs={verifiedDepthUsd:250000,verifiedMarketCapUsd:1000000,lpSecurityPoints:25,lpVerified:true,
 largestIndependentPoolSharePct:40,impactPct:1,impactVerified:true,stabilityPoints:10,stabilityVerified:true};
function fixture(values=inputs){return {mint,updated_at:time,evidence:{mint,schemaVersion:2,status:'complete',
 observedAt:time,pools:[{address:mint}],poolInventoryComplete:true,batchErrors:[],providerReportedPools:1,verifiedDepth:true,lpSecurityVerified:values.lpVerified===true,
 finalScore:scoreLiquidityQuality(values).score,scoringEvidence:{version:1,methodology:'LIQUIDITY_QUALITY_V1_1',mint,
 observedAt:time,evidenceId:'a'.repeat(64),inputs:{...values},coverage:{complete:true,scope:'all_reported_pools',poolAddresses:[mint]},
 provenance:Object.keys(values).map(field=>({mint,source:'validated_protocol_decoder',kind:field.startsWith('stability')?'reserve_history':['verifiedDepthUsd','impactPct','impactVerified'].includes(field)?'simulation':'onchain_account',reference:'synthetic_proof_123456789',observedAt:time,
 fields:[field],validated:true,coverageComplete:true}))}}};}
function adapt(row){return adaptDashboardEvidence({result:{mint},now:Date.parse(time),workerEvidence:{version:'1.1',mint,liquidity:projectLiquidityCheckpoint(row,mint)}});}
test('completed version2 evidence reaches approved component scorer without granting calibration',()=>{
 const row=fixture(),before=JSON.stringify(row),out=adapt(row);
 assert.equal(out.liquidity.status,'complete');
 assert.equal(out.scores.liquidity_quality_safety.score,100);
 assert.equal(out.scores.liquidity_quality_safety.calibrated,false);
 assert.equal(consolidate(out.scores).score,null);
 assert.equal(JSON.stringify(row),before);
 assert.ok(!JSON.stringify(out).includes('workerSecret'));
});
test('partial version2 evidence awards only evidenced components',()=>{
 const row=fixture({verifiedDepthUsd:250000});row.evidence.status='partial';
 const out=adapt(row).scores.liquidity_quality_safety;
 assert.equal(out.score,null);assert.equal(out.components[0].points,25);
 assert.ok(out.components.slice(1).every(c=>c.points===null));
});
test('validated completed evidence retains its schema through both persistence paths',async()=>{
 const evidence=fixture().evidence,calls=[];
 const options={url:'https://fixture.supabase.co',serviceRoleKey:'synthetic-only',fetchImpl:async(url,init)=>{calls.push({url,row:JSON.parse(init.body)});return {ok:true};}};
 await persistLiquidityCheckpoint(evidence,options);await appendLiquiditySnapshot(evidence,options);
 assert.equal(calls[0].row.schema_version,2);assert.equal(calls[0].row.status,'complete');
 assert.equal(calls[1].row.evidence.schemaVersion,2);assert.equal(calls[1].row.status,'complete');
});
for(const [name,change] of [
 ['foreign mint',e=>e.scoringEvidence.mint='other'],
 ['unknown schema',e=>e.schemaVersion=3],
 ['asserted total',e=>e.finalScore=99],
 ['missing provenance',e=>e.scoringEvidence.provenance=[]],
 ['missing field proof',e=>e.scoringEvidence.provenance.pop()],
 ['wrong proof kind',e=>e.scoringEvidence.provenance[0].kind='reserve_history'],
 ['failed pool batch',e=>e.batchErrors.push({})],
 ['pool coverage mismatch',e=>e.pools[0].address='11111111111111111111111111111111'],
 ['unvalidated proof',e=>e.scoringEvidence.provenance[0].validated=false],
 ['incomplete coverage',e=>e.scoringEvidence.coverage.complete=false],
 ['depth verification mismatch',e=>e.verifiedDepth=false],
 ['lp verification mismatch',e=>e.lpSecurityVerified=false],
 ['nonfinite value',e=>e.scoringEvidence.inputs.impactPct=Infinity],
 ['credential URL',e=>e.scoringEvidence.provenance[0].reference='https://private?key=secret'],
 ['unknown scoring field',e=>e.scoringEvidence.inputs.extraPoints=100],
])test(`reject ${name}`,()=>{const row=fixture();change(row.evidence);assert.throws(()=>projectLiquidityCheckpoint(row,mint));});
test('adapter revalidates version2 projections and preserves freshness boundary',()=>{
 const projected=projectLiquidityCheckpoint(fixture(),mint);projected.scoringEvidence.inputs.impactPct=Infinity;
 const args={result:{mint},now:Date.parse(time),workerEvidence:{version:'1.1',mint,liquidity:projected}};
 assert.equal(adaptDashboardEvidence(args).scores.liquidity_quality_safety.score,null);
 projected.scoringEvidence.inputs.impactPct=1;args.now+=3600001;
 assert.equal(adaptDashboardEvidence(args).liquidity,null);
});

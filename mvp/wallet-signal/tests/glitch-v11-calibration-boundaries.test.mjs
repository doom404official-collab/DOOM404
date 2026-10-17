import test from "node:test";
import assert from "node:assert/strict";
import {scoreTokenSecurity,scoreHolderIntelligence,scoreCreatorIntelligence,scoreLiquidityQuality} from "../lib/glitchAttributeEnginesV11.mjs";
import {consolidate} from "../lib/glitchScoringV11.mjs";
test("fee boundaries and nonapplicable SPL extension",()=>{
 for(const [fee,expected] of [[0,25],[0.5,20],[1,20],[2,12],[3,12],[4,5],[5,5],[6,0]]){
  const r=scoreTokenSecurity({tokenProgram:"token-2022",authoritiesParsed:true,mintAuthority:null,freezeAuthority:null,feePercent:fee,feeConfigAuthorityReported:true,feeConfigAuthority:null});
  assert.equal(r.components[0].points,expected);
 }
 const spl=scoreTokenSecurity({tokenProgram:"spl-token",authoritiesParsed:true,mintAuthority:null,freezeAuthority:null});
 assert.equal(spl.score,100);assert.equal(spl.components[0].points,null);assert.equal(spl.components[0].reason,"not_applicable");
});
test("top20 and creator exposure boundary checks",()=>{
 const x=scoreHolderIntelligence({top20SharePct:65,networkScore:0,creatorTeamExposurePct:20,independencePoints:0,historyComplete:true,classificationComplete:true,creatorAttributionComplete:true});
 assert.equal(x.score,0);
 const y=scoreHolderIntelligence({top20SharePct:15,networkScore:35,creatorTeamExposurePct:1,independencePoints:10,historyComplete:true,classificationComplete:true,creatorAttributionComplete:true});
 assert.equal(y.score,100);
});
test("creator sale windows use complete history and separate prior launches",()=>{
 const x=scoreCreatorIntelligence({creatorVerified:true,holdingsPct:20,creatorHistoryComplete:true,soldPct1h:50,soldPct24h:50,soldPct7d:50,previousLaunchHistoryComplete:true,previousLaunchPoints:0});
 assert.equal(x.score,20);
 const y=scoreCreatorIntelligence({creatorVerified:true,holdingsPct:2,creatorHistoryComplete:false,soldPct1h:0,soldPct24h:0,soldPct7d:0});
 assert.equal(y.components[2].points,null);
});
test("liquidity boundaries and missing security proof",()=>{
 const x=scoreLiquidityQuality({verifiedDepthUsd:10000,verifiedMarketCapUsd:500000,lpSecurityPoints:0,lpVerified:true,largestIndependentPoolSharePct:100,impactPct:15,impactVerified:true,stabilityPoints:0,stabilityVerified:true});
 assert.equal(x.score,0);
 const y=scoreLiquidityQuality({verifiedDepthUsd:250000,verifiedMarketCapUsd:1000000,lpSecurityPoints:25,lpVerified:false,largestIndependentPoolSharePct:40,impactPct:1,impactVerified:true,stabilityPoints:10,stabilityVerified:true});
 assert.equal(y.score,null);
});
test("overall score stays withheld even if mathematical components are complete but uncalibrated",()=>{
 const result={};
 for(const id of ["token_security","holder_intelligence","creator_intelligence","liquidity_quality_safety"])result[id]={score:100,complete:true,calibrated:false};
 assert.equal(consolidate(result).score,null);
});

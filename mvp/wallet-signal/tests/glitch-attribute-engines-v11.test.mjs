import test from "node:test";
import assert from "node:assert/strict";
import {scoreTokenSecurity,scoreHolderIntelligence,scoreCreatorIntelligence,scoreLiquidityQuality} from "../lib/glitchAttributeEnginesV11.mjs";
test("standard SPL fee checks are inapplicable and do not lower coverage",()=>{
 const r=scoreTokenSecurity({tokenProgram:"spl-token",authoritiesParsed:true,mintAuthority:null,freezeAuthority:null});
 assert.equal(r.score,100);assert.equal(r.coveragePct,100);assert.equal(r.components.length,4);
 assert.equal(r.components.filter(x=>x.reason==="not_applicable").length,2);
 assert.equal(r.calibrated,false);
});
test("active mint authority lowers controls assessment",()=>{
 const r=scoreTokenSecurity({tokenProgram:"spl-token",authoritiesParsed:true,mintAuthority:"11111111111111111111111111111111",freezeAuthority:null});
 assert.equal(r.score,50);
});
test("unknown Token-2022 fee configuration cannot be assumed revoked",()=>{
 const r=scoreTokenSecurity({tokenProgram:"token-2022",authoritiesParsed:true,mintAuthority:null,freezeAuthority:null,feePercent:0});
 assert.equal(r.score,null);assert.equal(r.complete,false);
});
test("holder network requires full history; unknown is not independent",()=>{
 const r=scoreHolderIntelligence({top20SharePct:20,networkScore:35,creatorTeamExposurePct:0,independencePoints:10,creatorAttributionComplete:true});
 assert.equal(r.score,null);
 assert.equal(r.components[1].points,null);
 assert.equal(r.components[3].points,null);
});
test("complete holder data produces correct 35/35/20/10 score",()=>{
 const r=scoreHolderIntelligence({top20SharePct:15,networkScore:35,creatorTeamExposurePct:0,independencePoints:10,historyComplete:true,classificationComplete:true,creatorAttributionComplete:true});
 assert.equal(r.score,100);
 assert.deepEqual(r.components.map(x=>x.max),[35,35,20,10]);
});
test("creator transfers without verified sale history do not earn selling points",()=>{
 const r=scoreCreatorIntelligence({creatorVerified:true,holdingsPct:1,soldPct1h:0,soldPct24h:0,soldPct7d:0});
 assert.equal(r.score,null);assert.equal(r.components[2].points,null);
});
test("creator complete evidence computes four weighted components",()=>{
 const r=scoreCreatorIntelligence({creatorVerified:true,holdingsPct:2,creatorHistoryComplete:true,soldPct1h:0,soldPct24h:0,soldPct7d:0,previousLaunchPoints:30,previousLaunchHistoryComplete:true});
 assert.equal(r.score,100);
});
test("provider liquidity estimate alone cannot yield liquidity score",()=>{
 const r=scoreLiquidityQuality({verifiedDepthUsd:250000,verifiedMarketCapUsd:1000000});
 assert.equal(r.score,null);
});
test("liquidity complete evidence is 100 and requires all six components",()=>{
 const r=scoreLiquidityQuality({verifiedDepthUsd:250000,verifiedMarketCapUsd:1000000,lpSecurityPoints:25,lpVerified:true,largestIndependentPoolSharePct:40,impactPct:1,impactVerified:true,stabilityPoints:10,stabilityVerified:true});
 assert.equal(r.score,100);
 assert.deepEqual(r.components.map(x=>x.max),[25,20,25,10,10,10]);
});

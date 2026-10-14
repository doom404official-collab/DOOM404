import test from "node:test";
import assert from "node:assert/strict";
import { assessTokenControls } from "../lib/tokenControlsAssessment.mjs";
test("creator does not affect token controls",()=>{
 const args={result:{tokenProgram:"spl-token",mintAuthority:null,freezeAuthority:null},concentration:{largestAccountSharePct:25}};
 const a=assessTokenControls({...args,creatorEvidence:null});
 const b=assessTokenControls({...args,creatorEvidence:{status:"VERIFIED",creator:"any"}});
 assert.deepEqual(a,b);
 assert.equal(a.score,null);
 assert.equal(a.provisionalScore,100);
 assert.equal(a.checks.find(x=>x.id==="token2022_fee").status,"not_applicable");
});
test("missing authorities cannot be scored as revoked",()=>{
 const x=assessTokenControls({result:{tokenProgram:"spl-token"},creatorEvidence:null});
 assert.equal(x.score,null);
 assert.equal(x.checks[0].status,"unknown");
});
test("active mint authority is observable centralization, not scam probability",()=>{
 const x=assessTokenControls({result:{tokenProgram:"spl-token",mintAuthority:"wallet",freezeAuthority:null}});
 assert.equal(x.score,null);
 assert.equal(x.provisionalScore,0);
 assert.equal(x.notSafetyScore,true);
});
test("unknown Token-2022 fee authority is not zero risk",()=>{
 const x=assessTokenControls({result:{tokenProgram:"token-2022",mintAuthority:null,freezeAuthority:null},
 extensions:{verified:true,transferFee:{status:"observed",configAuthorityReported:false}}});
 assert.equal(x.checks[1].points,null);
 assert.equal(x.checks[1].status,"unknown");
});

test("creator absence does not suppress observed concentration",()=>{
 const a=assessTokenControls({result:{tokenProgram:"spl-token",mintAuthority:null,freezeAuthority:null},concentration:{largestAccountSharePct:41}});
 assert.equal(a.checks.find(x=>x.id==="account_concentration").status,"observed_unclassified");
 assert.equal(a.checks.find(x=>x.id==="account_concentration").observedSharePct,41);
 assert.equal(a.score,null);
 assert.equal(a.creatorIndependent,true);
});
test("partial authority payload remains unknown despite null mint authority",()=>{
 const a=assessTokenControls({result:{tokenProgram:"spl-token",mintAuthority:null}});
 assert.equal(a.checks.find(x=>x.id==="mint_freeze").status,"unknown");
 assert.equal(a.provisionalScore,null);
});
test("explicitly unparsed authorities are not scored",()=>{
 const a=assessTokenControls({result:{tokenProgram:"spl-token",mintAuthority:null,freezeAuthority:null,authorityDetailsStatus:"not_parsed"}});
 assert.equal(a.checks.find(x=>x.id==="mint_freeze").points,null);
});
test("verified fee authority can be assessed without creator",()=>{
 const a=assessTokenControls({result:{tokenProgram:"token-2022",mintAuthority:null,freezeAuthority:null},
 extensions:{verified:true,transferFee:{status:"observed",configAuthorityReported:true,configAuthority:"authority"}}});
 assert.equal(a.checks.find(x=>x.id==="token2022_fee").status,"fee_authority_active");
 assert.equal(a.score,null);
});

test("observed concentration contributes evidence coverage but not numeric score",()=>{
 const x=assessTokenControls({result:{tokenProgram:"spl-token"},concentration:{largestAccountSharePct:42}});
 assert.equal(x.score,null);
 assert.equal(x.provisionalScore,null);
 assert.equal(x.coveragePct,0);
 assert.equal(x.observedEvidencePct,33);
});
test("verified standard SPL controls exclude nonapplicable fee extension",()=>{
 const x=assessTokenControls({result:{tokenProgram:"spl-token",mintAuthority:null,freezeAuthority:null}});
 assert.equal(x.coveragePct,67);
 assert.equal(x.observedEvidencePct,67);
 assert.equal(x.checks.find(c=>c.id==="token2022_fee").status,"not_applicable");
});
test("invalid concentration cannot inflate evidence coverage",()=>{
 const x=assessTokenControls({result:{tokenProgram:"spl-token"},concentration:{largestAccountSharePct:130}});
 assert.equal(x.observedEvidencePct,0);
 assert.equal(x.checks.find(c=>c.id==="account_concentration").status,"unknown");
});

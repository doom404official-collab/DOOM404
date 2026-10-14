import test from "node:test";
import assert from "node:assert/strict";
import { assessTokenControls } from "../lib/tokenControlsAssessment.mjs";
test("creator does not affect token controls",()=>{
 const args={result:{tokenProgram:"spl-token",mintAuthority:null,freezeAuthority:null},concentration:{largestAccountSharePct:25}};
 const a=assessTokenControls({...args,creatorEvidence:null});
 const b=assessTokenControls({...args,creatorEvidence:{status:"VERIFIED",creator:"any"}});
 assert.deepEqual(a,b);
 assert.equal(a.score,100);
 assert.equal(a.checks.find(x=>x.id==="token2022_fee").status,"not_applicable");
});
test("missing authorities cannot be scored as revoked",()=>{
 const x=assessTokenControls({result:{tokenProgram:"spl-token"},creatorEvidence:null});
 assert.equal(x.score,null);
 assert.equal(x.checks[0].status,"unknown");
});
test("active mint authority is observable centralization, not scam probability",()=>{
 const x=assessTokenControls({result:{tokenProgram:"spl-token",mintAuthority:"wallet",freezeAuthority:null}});
 assert.equal(x.score,0);
 assert.equal(x.notSafetyScore,true);
});
test("unknown Token-2022 fee authority is not zero risk",()=>{
 const x=assessTokenControls({result:{tokenProgram:"token-2022",mintAuthority:null,freezeAuthority:null},
 extensions:{verified:true,transferFee:{status:"observed",configAuthorityReported:false}}});
 assert.equal(x.checks[1].points,null);
 assert.equal(x.checks[1].status,"unknown");
});

import test from "node:test";
import assert from "node:assert/strict";
import { classifyHistoricalDeploymentEvidence } from "../lib/historicalDeploymentEvidence.mjs";
const signer="HrHJputHcA8mkwrcQB3GkrJ2u1f7Fm4LzAZptSYSsUcf";
const evidence={kind:"legacy_create_three_strings",mintMatched:true,accountCount:14,
 exactlyThreeStrings:true,messageSigner:true,userAccount:signer,indexedCreatorMatchesUser:true};
test("legacy deployment signer match does not assert creator identity",()=>{
 const result=classifyHistoricalDeploymentEvidence([evidence],signer);
 assert.equal(result.status,"DEPLOYMENT_SIGNER_ONCHAIN_MATCH");
 assert.equal(result.deploymentSigner,signer);
 assert.equal(result.launchpadCreator,null);
 assert.equal(result.creatorVerified,false);
});
test("reject absent signer evidence or conflicting indexed creator",()=>{
 assert.equal(classifyHistoricalDeploymentEvidence([{...evidence,messageSigner:false}],signer).status,"UNRESOLVED");
 assert.equal(classifyHistoricalDeploymentEvidence([evidence],"DifferentCreator").status,"UNRESOLVED");
});

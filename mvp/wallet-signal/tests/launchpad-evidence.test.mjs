import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const pumpSource=readFileSync(new URL("../lib/pumpLaunchEvidence.js",import.meta.url),"utf8");
const launchSource=readFileSync(new URL("../lib/launchpadEvidence.js",import.meta.url),"utf8");
const pumpUrl="data:text/javascript,"+encodeURIComponent(pumpSource);
const moduleUrl="data:text/javascript,"+encodeURIComponent(launchSource.replace("./pumpLaunchEvidence.js",pumpUrl));
const {detectLaunchpadEvidence,LAUNCHPAD_REGISTRY}=await import(moduleUrl);
const mint="So11111111111111111111111111111111111111112";
test("only independently registered program adapters are supported",()=>{
 assert.equal(LAUNCHPAD_REGISTRY.length,1);
 assert.equal(LAUNCHPAD_REGISTRY[0].id,"pump_fun");
 assert.equal(LAUNCHPAD_REGISTRY[0].creatorDecoderVerified,false);
});
test("unrecognized launchpad returns unknown without guessing creator",()=>{
 const result=detectLaunchpadEvidence({mint,transaction:{transaction:{message:{instructions:[{programId:"unknown"}],accountKeys:[]}},meta:{err:null}}});
 assert.equal(result.status,"unverified");
 assert.equal(result.launchCreator,null);
 assert.equal(result.platformVerifiedAsLauncher,false);
});
test("Pump.fun interaction is not proof of platform launch or creator",()=>{
 const result=detectLaunchpadEvidence({mint,signature:"sig",transaction:{
  transaction:{message:{instructions:[{programId:LAUNCHPAD_REGISTRY[0].programIds[0],accounts:[mint]}],accountKeys:[]}},
  meta:{err:null}
 }});
 assert.equal(result.platformId,"pump_fun");
 assert.equal(result.status,"program_interaction_observed");
 assert.equal(result.platformVerifiedAsLauncher,false);
 assert.equal(result.launchCreatorVerified,false);
});

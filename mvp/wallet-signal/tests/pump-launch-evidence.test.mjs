import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/pumpLaunchEvidence.js",import.meta.url),"utf8");
const {detectPumpLaunch,PUMP_FUN_PROGRAM}=await import("data:text/javascript,"+encodeURIComponent(source));
const mint="So11111111111111111111111111111111111111112";
test("unknown transaction does not create a launch claim",()=>{
 assert.equal(detectPumpLaunch({mint,transaction:null}).status,"unverified");
});
test("unrelated program is not a Pump.fun launch",()=>{
 const result=detectPumpLaunch({mint,transaction:{transaction:{message:{instructions:[{programId:"other"}],accountKeys:[]}},meta:{err:null}}});
 assert.equal(result.status,"not_observed");
});
test("program interaction never automatically verifies a creator",()=>{
 const result=detectPumpLaunch({mint,signature:"sig",transaction:{
  transaction:{message:{instructions:[{programId:PUMP_FUN_PROGRAM,accounts:[mint]}],accountKeys:[{pubkey:"signer1",signer:true}]}},
  meta:{err:null},blockTime:123
 }});
 assert.equal(result.status,"program_interaction_observed");
 assert.equal(result.launchCreator,null);
 assert.equal(result.launchCreatorVerified,false);
 assert.deepEqual(result.signers,["signer1"]);
});
test("mint must be linked to inspected transaction",()=>{
 const result=detectPumpLaunch({mint,transaction:{
  transaction:{message:{instructions:[{programId:PUMP_FUN_PROGRAM,accounts:["other"]}],accountKeys:[]}},meta:{err:null}
 }});
 assert.equal(result.status,"unverified");
});

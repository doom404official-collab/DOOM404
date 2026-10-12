import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const pump=readFileSync(new URL("../lib/pumpLaunchEvidence.js",import.meta.url),"utf8");
const {PUMP_FUN_PROGRAM,detectPumpLaunch}=await import("data:text/javascript,"+encodeURIComponent(pump));
test("official Pump.fun program ID is used for detection",()=>{
 assert.equal(PUMP_FUN_PROGRAM,"6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
});
test("official program interaction still does not prove creator",()=>{
 const mint="So11111111111111111111111111111111111111112";
 const result=detectPumpLaunch({mint,signature:"fixture",transaction:{
  transaction:{message:{accountKeys:[],instructions:[{programId:PUMP_FUN_PROGRAM,accounts:[mint]}]}},
  meta:{err:null}
 }});
 assert.equal(result.status,"program_interaction_observed");
 assert.equal(result.launchCreatorVerified,false);
});

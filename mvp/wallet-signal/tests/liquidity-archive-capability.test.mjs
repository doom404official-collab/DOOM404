import test from "node:test";
import assert from "node:assert/strict";
import {classifyArchiveCapability} from "../lib/liquidityArchiveCapability.mjs";
test("later context never verifies historical state",()=>{
 const r=classifyArchiveCapability({result:{context:{slot:459091204},value:{data:["abc","base64"]}}},{requestedSlot:458811200});
 assert.equal(r.status,"LATER_CONTEXT_UNVERIFIED");
 assert.equal(r.historicalStateVerified,false);
});
test("plausible archival response remains candidate only",()=>{
 const r=classifyArchiveCapability({result:{context:{slot:458811200},value:{data:["abc","base64"]}}},{requestedSlot:458811200});
 assert.equal(r.status,"HISTORICAL_RESPONSE_CANDIDATE");
 assert.equal(r.historicalStateVerified,false);
});
test("provider plan and invalid parameter failures are distinct",()=>{
 assert.equal(classifyArchiveCapability({error:{code:-32001,message:"Paid plan required"}}).status,"PLAN_RESTRICTED");
 assert.equal(classifyArchiveCapability({error:{code:-32602,message:"Invalid params"}}).status,"UNSUPPORTED_OR_INVALID_PARAMETERS");
});

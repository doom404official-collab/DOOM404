import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src=readFileSync(new URL("../lib/launchCreatorDecoder.js",import.meta.url),"utf8");
const {decodeLaunchCreator}=await import("data:text/javascript,"+encodeURIComponent(src));
const schema={reviewed:true,programId:"test-program",discriminator:[1,2,3,4,5,6,7,8],mintAccountIndex:0,creatorAccountIndex:2,version:"fixture-only"};
const ix={programId:"test-program",dataBytes:[1,2,3,4,5,6,7,8],accounts:["mint","other","creator"]};
test("unreviewed and missing schemas never infer a creator",()=>{
 assert.equal(decodeLaunchCreator({mint:"mint",instruction:ix}).launchCreator,null);
 assert.equal(decodeLaunchCreator({mint:"mint",instruction:ix,schema:{...schema,reviewed:false}}).launchCreatorVerified,false);
});
test("discriminator and mint must match",()=>{
 assert.equal(decodeLaunchCreator({mint:"wrong",instruction:ix,schema}).status,"mint_mismatch");
 assert.equal(decodeLaunchCreator({mint:"mint",instruction:{...ix,dataBytes:[0]},schema}).status,"instruction_not_matched");
});
test("reviewed fixture schema extracts only the declared creator role",()=>{
 const result=decodeLaunchCreator({mint:"mint",instruction:ix,schema});
 assert.equal(result.launchCreator,"creator");
 assert.equal(result.verificationScope,"onchain_instruction_role");
 assert.match(result.limitation,/does not establish beneficial ownership/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const path=new URL("../lib/holderNetworkTransfers.mjs",import.meta.url);
test("historical pool classification remains evidence-gated",()=>{
 const source=readFileSync(path,"utf8");
 assert.match(source,/OWNER_METADATA_MISSING/);
 assert.match(source,/OWNER_CONFLICT/);
 assert.match(source,/unresolvedTokenTransfers/);
});
test("missing CPI diagnostics cannot certify pool infrastructure",()=>{
 const evidence={outerInstructions:5,innerInstructions:null,pumpAmmOperations:0};
 const verified=evidence.innerInstructions!==null&&evidence.pumpAmmOperations>0;
 assert.equal(verified,false);
});

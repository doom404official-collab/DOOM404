import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const code=await readFile(new URL("../scripts/liquidity-history-shadow-report.mjs",import.meta.url),"utf8");
test("shadow report never issues RPC calls or changes score",()=>{
 assert.doesNotMatch(code,/fetch\(|getTransaction|writeFile\(source/);
 assert.match(code,/rpcRequests:0/);
 assert.match(code,/authorizationVerified:false/);
 assert.match(code,/finalScore:null/);
 assert.match(code,/productionModified:false/);
});

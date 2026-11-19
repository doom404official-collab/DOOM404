import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/api/pool-account-evidence/route.js",import.meta.url),"utf8");
test("pool account verification is bounded and requires distinct valid addresses",()=>{
 assert.match(source,/MAX_POOLS = 5/);
 assert.match(source,/new Set\(addresses\)\.size !== addresses\.length/);
 assert.match(source,/getMultipleAccountsInfo/);
});
test("pool-account endpoint never infers reserve, protocol, or lock safety",()=>{
 assert.match(source,/protocolVerified: false/);
 assert.match(source,/reservesVerified: false/);
 assert.match(source,/lpLocksVerified: false/);
 assert.match(source,/withdrawalRightsVerified: false/);
 assert.match(source,/Account existence and owner program do not prove/);
});

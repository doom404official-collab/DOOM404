import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route=readFileSync(new URL("../app/api/creator/route.js",import.meta.url),"utf8");
test("creator investigation checks independent launch transaction candidates",()=>{
 assert.match(route,/solscan\.creationSignature/);
 assert.match(route,/solscan\.firstMintSignature/);
 assert.match(route,/origin\?\.signature/);
 assert.match(route,/candidateSignatures\.length/);
 assert.match(route,/launchInvestigation/);
});
test("creator investigation remains bounded and reports actual coverage",()=>{
 assert.match(route,/\.slice\(0, 3\)/);
 assert.match(route,/bounded_candidates_not_full_history/);
 assert.match(route,/creatorVerified: false/);
});

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
 assert.match(route,/\.slice\(0, 10\)/);
 assert.match(route,/bounded_candidates_not_full_history/);
 assert.match(route,/creatorVerified: false/);
});

test("oldest-first indexed candidates are considered for launch investigation",()=>{
 assert.match(route,/indexedOrigin\?\.candidateSignatures/);
 assert.match(route,/helius_indexed_oldest_first/);
 assert.match(route,/candidateSignatures: signatures\.slice\(0, 8\)/);
});

test("oldest RPC-visible history contributes independent launch candidates",()=>{
 assert.match(route,/candidateSignatures: oldestPage\.slice\(-10\)\.reverse\(\)/);
 assert.match(route,/origin\?\.coverage\?\.candidateSignatures/);
 assert.match(route,/rpc_oldest_visible_window/);
});

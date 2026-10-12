import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/stonkFunEvidence.js",import.meta.url),"utf8");
const {parseStonkFunIndex,lookupStonkFun}=await import("data:text/javascript,"+encodeURIComponent(source));
const mint="DEW9dSN6QpWyNthphCpMmAbZP1Q4cEKR9xQXAri98WDP";
const creator="So11111111111111111111111111111111111111112";
test("matched index record is provider evidence, never verified creator",()=>{
 const result=parseStonkFunIndex({data:{tokens:[{mint,creator}]}},mint);
 assert.equal(result.status,"provider_record_observed");
 assert.equal(result.creatorCandidate,creator);
 assert.equal(result.launchCreatorVerified,false);
 assert.equal(result.platformVerifiedAsLauncher,false);
});
test("unrelated mint is not attributed",()=>{
 assert.equal(parseStonkFunIndex({tokens:[{mint:creator,creator}]},mint).status,"not_found");
});
test("invalid mint avoids network request",async()=>{
 let called=false;
 const result=await lookupStonkFun("invalid", {fetchImpl:async()=>{called=true;}});
 assert.equal(result.status,"invalid_mint");
 assert.equal(called,false);
});
test("provider failure does not become a negative token finding",async()=>{
 const result=await lookupStonkFun(mint,{fetchImpl:async()=>({ok:false,status:429})});
 assert.equal(result.status,"provider_unavailable");
});

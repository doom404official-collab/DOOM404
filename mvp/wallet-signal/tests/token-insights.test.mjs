import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../lib/tokenInsights.js", import.meta.url), "utf8");
const { selectTokenInsights } = await import("data:text/javascript," + encodeURIComponent(source));

test("higher priority permanent delegate displaces routine liquidity observation", () => {
 const rows = selectTokenInsights({
  result: {},
  extensions: { verified: true, extensions: [{type:"permanentDelegate"}], transferFee:{status:"observed",configAuthorityReported:true,configAuthority:"abc",olderFee:{percentage:1},newerFee:{percentage:1}}},
  concentration: {largestAccountSharePct:4},
  liquidity: {reportedLiquidityUsd:100000,poolCountReturned:2,observedAt:"2026-10-12T07:00:00Z"},
  now:Date.parse("2026-10-12T07:01:00Z")
 });
 assert.equal(rows.length,3);
 assert.equal(rows[0].title,"Permanent delegate extension observed");
 assert.ok(!rows.some(x=>x.title==="Reported liquidity"));
});
test("no provider data produces coverage notice, not safety verdict", () => {
 const rows=selectTokenInsights({result:{},now:0});
 assert.equal(rows.length,1);
 assert.match(rows[0].detail,/not a safety assessment/);
});
test("old market-data retrieval is marked stale", () => {
 const rows=selectTokenInsights({result:{},liquidity:{reportedLiquidityUsd:1,poolCountReturned:1,observedAt:"2026-10-10T00:00:00Z"},now:Date.parse("2026-10-12T00:00:00Z")});
 assert.match(rows[0].confidence,/stale/);
});

test("evidence classes distinguish direct observations from market estimates", () => {
 const rows = selectTokenInsights({
  result:{}, concentration:{largestAccountSharePct:4},
  liquidity:{reportedLiquidityUsd:1000,poolCountReturned:1,observedAt:"2026-10-12T07:00:00Z"},
  now:Date.parse("2026-10-12T07:01:00Z")
 });
 assert.equal(rows.find(x=>x.category==="concentration").evidenceClass,"onchain_observed");
 assert.equal(rows.find(x=>x.category==="liquidity").evidenceClass,"provider_reported");
 assert.equal(selectTokenInsights({result:{}})[0].evidenceClass,"unverified");
});

test("standard SPL token does not invent Token-2022 fees", () => {
 const rows=selectTokenInsights({
  result:{tokenProgram:"spl-token"},
  extensions:null,
  concentration:{largestAccountSharePct:5.75},
  liquidity:{reportedLiquidityUsd:793000,poolCountReturned:30,observedAt:"2026-10-12T08:00:00Z"},
  now:Date.parse("2026-10-12T08:01:00Z")
 });
 assert.equal(rows.length,2);
 assert.ok(rows.every(x=>!x.title.toLowerCase().includes("fee")));
 assert.ok(rows.every(x=>!x.detail.toLowerCase().includes("safe")));
});
test("transfer hook outranks routine concentration and liquidity", () => {
 const rows=selectTokenInsights({
  result:{},extensions:{verified:true,extensions:[{type:"transferHook"}]},
  concentration:{largestAccountSharePct:4},
  liquidity:{reportedLiquidityUsd:200000,poolCountReturned:3,observedAt:"2026-10-12T08:00:00Z"},
  now:Date.parse("2026-10-12T08:01:00Z")
 });
 assert.equal(rows[0].title,"Transfer hook extension observed");
 assert.match(rows[0].detail,/not been verified/);
});
test("concentrated token account is prioritized without assigning ownership", () => {
 const rows=selectTokenInsights({
  result:{},concentration:{largestAccountSharePct:31},
  liquidity:{reportedLiquidityUsd:1000,poolCountReturned:1,observedAt:"2026-10-12T08:00:00Z"},
  now:Date.parse("2026-10-12T08:01:00Z")
 });
 assert.equal(rows[0].category,"concentration");
 assert.match(rows[0].detail,/not unique owners/);
});
test("unknown fee configuration authority is not called revoked", () => {
 const rows=selectTokenInsights({
  result:{},extensions:{transferFee:{status:"observed",configAuthorityReported:false,olderFee:{percentage:1},newerFee:{percentage:1}}}
 });
 assert.match(rows[0].detail,/unknown/);
 assert.doesNotMatch(rows[0].detail,/revoked/);
});
test("numeric insight count never exceeds three", () => {
 const rows=selectTokenInsights({
  result:{mintAuthority:"mint-admin",freezeAuthority:"freeze-admin"},
  extensions:{verified:true,extensions:[{type:"permanentDelegate"},{type:"transferHook"}],transferFee:{status:"observed",configAuthorityReported:true,configAuthority:"admin",olderFee:{percentage:1},newerFee:{percentage:1}}},
  concentration:{largestAccountSharePct:25},
  liquidity:{reportedLiquidityUsd:100,poolCountReturned:1,observedAt:"2026-10-12T08:00:00Z"}
 });
 assert.equal(rows.length,3);
});

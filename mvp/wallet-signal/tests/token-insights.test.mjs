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

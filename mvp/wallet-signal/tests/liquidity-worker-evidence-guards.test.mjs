import test from "node:test";
import assert from "node:assert/strict";
import {validateLiquidityPoolBatch,selectPreviousLiquidityCheckpoint} from "../lib/liquidityWorkerEvidenceGuards.mjs";
test("pool batches must match requested distinct identities, not only count",()=>{
 assert.equal(validateLiquidityPoolBatch({mint:"mint",pools:[{pairAddress:"b"},{pairAddress:"a"}]},"mint",["a","b"]),true);
 for(const pools of [[{pairAddress:"a"},{pairAddress:"a"}],[{pairAddress:"a"},{pairAddress:"wrong"}],[{},{}],[]]) assert.throws(()=>validateLiquidityPoolBatch({mint:"mint",pools},"mint",["a","b"]),/INVALID_LIQUIDITY_POOL_BATCH/);
 assert.throws(()=>validateLiquidityPoolBatch({mint:"other",pools:[{pairAddress:"a"}]},"mint",["a"]));
});
test("previous checkpoint must match mint and precede current observation",()=>{
 const now="2026-10-20T06:00:00Z", previous={mint:"mint",observedAt:"2026-10-19T06:00:00Z",pools:[]};
 assert.equal(selectPreviousLiquidityCheckpoint(previous,"mint",now).checkpoint,previous);
 assert.equal(selectPreviousLiquidityCheckpoint(null,"mint",now).checkpoint,null);
 for(const change of [{mint:"other"},{observedAt:now},{observedAt:"2026-10-21T06:00:00Z"},{observedAt:"invalid"},{observedAt:"100"},{observedAt:"2026-02-30T00:00:00Z"},{observedAt:null},{pools:{}},{pools:[null]},{pools:[undefined]},{pools:[{}]},{pools:[{pairAddress:""}]},{pools:[{pairAddress:"a"},{pairAddress:"a"}]}]){
  const r=selectPreviousLiquidityCheckpoint({...previous,...change},"mint",now);
  assert.equal(r.checkpoint,null); assert.equal(r.reason,"incompatible_previous_checkpoint");
 }
});

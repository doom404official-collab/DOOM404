import test from "node:test";
import assert from "node:assert/strict";
import {previousFailedLiquiditySignatures} from "../lib/liquidityFailedSignatureHistory.mjs";
test("excludes only unavailable signatures for matching pool",()=>{
 const previous={transactionEvidence:[{pairAddress:"pool",decodedTransactions:[{signature:"a",status:"unavailable"},{signature:"b",status:"candidate_only"}]},{pairAddress:"other",decodedTransactions:[{signature:"c",status:"unavailable"}]}]};
 assert.deepEqual(previousFailedLiquiditySignatures(previous,"pool"),["a"]);
});
test("missing checkpoint produces no exclusions",()=>{
 assert.deepEqual(previousFailedLiquiditySignatures(null,"pool"),[]);
});

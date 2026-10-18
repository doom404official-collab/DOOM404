import test from "node:test";
import assert from "node:assert/strict";
import {summarizePoolSignatures} from "../lib/liquidityTransactionEvidence.mjs";
test("bounds signatures without attributing reserve movement",()=>{
 const rows=Array.from({length:70},(_,i)=>({signature:"sig"+i,slot:i,err:null}));
 const result=summarizePoolSignatures(rows);
 assert.equal(result.observedCount,50);
 assert.equal(result.withdrawalsVerified,0);
 assert.equal(result.reserveMovementAttributed,false);
 assert.equal(result.classificationStatus,"pending_transaction_decode");
});

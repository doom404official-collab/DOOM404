import test from "node:test";
import assert from "node:assert/strict";
import {inspectCreatorUpdateInstructions} from "../lib/liquidityCreatorUpdateEvidence.mjs";
test("detects set creator only for target pool",()=>{
 const p="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
 const tx={transaction:{message:{staticAccountKeys:[p,"pool","other"],compiledInstructions:[{programIdIndex:0,accountKeyIndexes:[1],data:Buffer.from("d295802dbc3a4eaf","hex")},{programIdIndex:0,accountKeyIndexes:[2],data:Buffer.from("d0089f044aaf103a","hex")}]}}};
 const result=inspectCreatorUpdateInstructions(tx,"pool");
 assert.equal(result.updates.length,2);
 assert.equal(result.updates[0].poolMatched,true);
 assert.equal(result.updates[1].poolMatched,false);
 assert.equal(result.creatorChangeVerified,false);
});

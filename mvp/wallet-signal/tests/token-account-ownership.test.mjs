import test from "node:test";
import assert from "node:assert/strict";
import { summarizeResolvedTokenAccounts } from "../lib/tokenAccountOwnership.js";
const accounts=[{tokenAccount:"a",sharePct:10},{tokenAccount:"b",sharePct:5},{tokenAccount:"c",sharePct:3}];
const parsed=[{value:{data:{parsed:{type:"account",info:{owner:"wallet1"}}}}},
 {value:{data:{parsed:{type:"account",info:{owner:"wallet1"}}}}},null];
test("groups observed token accounts by token-account owner only",()=>{
 const x=summarizeResolvedTokenAccounts(accounts,parsed);
 assert.equal(x.resolvedAccountCount,2);
 assert.equal(x.observedOwnerGroups[0].sharePct,15);
 assert.equal(x.beneficialOwnersVerified,false);
 assert.equal(x.accounts[2].accountCategory,"UNCLASSIFIED");
});

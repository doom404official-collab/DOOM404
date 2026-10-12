import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOriginTransaction, resolveCreatorRole, AUDITED_CREATOR_SCHEMAS } from "../lib/creatorOriginResolver.js";
const mint="DEW9dSN6QpWyNthphCpMmAbZP1Q4cEKR9xQXAri98WDP";
const candidate="9pkJqJLtefuna3GLtKZyF5DBWwEGUdxZUSGCmf5jZhA9";
const program="LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const tx={slot:123,meta:{err:null,loadedAddresses:{writable:[mint],readonly:[program]},innerInstructions:[{index:0,instructions:[{programIdIndex:2,accounts:[1,0]}]}]},transaction:{signatures:["example"],message:{staticAccountKeys:[candidate],instructions:[{programIdIndex:2,accounts:[1,0]}]}}};
test("resolves versioned compiled and inner instruction addresses",()=>{
 const out=normalizeOriginTransaction(tx);
 assert.equal(out.status,"normalized");
 assert.equal(out.instructions.length,2);
 assert.equal(out.instructions[1].programId,program);
 assert.deepEqual(out.instructions[1].accounts,[mint,candidate]);
});
test("no schema means no creator verification",()=>{
 assert.equal(AUDITED_CREATOR_SCHEMAS.length,0);
 assert.equal(resolveCreatorRole({mint,transaction:tx}).status,"unresolved");
});
test("caller reviewed flag alone cannot authorize decoding",()=>{
 const out=resolveCreatorRole({mint,transaction:tx,registry:[{reviewed:true,programId:program,version:"unreviewed",discriminator:"x",decode:()=>({mint,creator:candidate,role:"launchpad_designated_creator"})}]});
 assert.equal(out.status,"unresolved");
});
test("failed transactions are rejected",()=>{
 assert.equal(resolveCreatorRole({mint,transaction:{...tx,meta:{...tx.meta,err:{InstructionError:[0,"Custom"]}}}}).status,"unresolved");
});

test("caller cannot inject a verified creator via a supplied schema registry",()=>{ const result=resolveCreatorRole({mint,transaction:tx,registry:[{internallyAudited:true,programId:program,version:"fake",discriminator:"x",decode:()=>({mint,creator:candidate,role:"launchpad_designated_creator"})}]}); assert.equal(result.status,"unresolved"); });

import test from "node:test";
import assert from "node:assert/strict";
import { newCreatorCheckpoint, advanceCreatorCheckpoint, validateCreatorCheckpoint } from "../lib/creatorInvestigationCheckpoint.mjs";
const mint="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const indexedCreator="6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC";
const sig1="2".repeat(70), sig2="3".repeat(70);
test("checkpoint persists pending work and avoids re-inspecting completed signatures",()=>{
  const initial=newCreatorCheckpoint({mint,indexedCreator,createdTimestamp:1789500020000});
  const first=advanceCreatorCheckpoint(initial,{paginationToken:"opaque-cursor",signatures:[sig1,sig2],inspected:[sig1]});
  assert.deepEqual(first.pendingSignatures,[sig2]);
  const restored=validateCreatorCheckpoint(JSON.parse(JSON.stringify(first)),{mint,indexedCreator});
  assert.equal(restored.nextPaginationToken,"opaque-cursor");
  const second=advanceCreatorCheckpoint(restored,{inspected:[sig2]});
  assert.deepEqual(second.pendingSignatures,[]);
  assert.equal(second.inspectedSignatures.length,2);
});
test("rejects checkpoint reuse for another token or creator",()=>{
  const cp=newCreatorCheckpoint({mint,indexedCreator,createdTimestamp:1789500020000});
  assert.throws(()=>validateCreatorCheckpoint(cp,{mint:"11111111111111111111111111111112"}),/CHECKPOINT_IDENTITY_MISMATCH/);
  assert.throws(()=>validateCreatorCheckpoint(cp,{indexedCreator:"11111111111111111111111111111112"}),/CHECKPOINT_IDENTITY_MISMATCH/);
});
test("rejects malformed persisted checkpoints",()=>{
  const cp=newCreatorCheckpoint({mint,indexedCreator,createdTimestamp:1789500020000});
  assert.throws(()=>validateCreatorCheckpoint({...cp,pendingSignatures:["bad"]}),/INVALID_CHECKPOINT/);
});

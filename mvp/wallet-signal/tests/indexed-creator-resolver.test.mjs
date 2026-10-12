import test from "node:test";
import assert from "node:assert/strict";
import { resolveIndexedCreator } from "../lib/indexedCreatorResolver.mjs";
const mint = "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
test("indexed wallet without creation signature remains unverified", async () => {
  const result = await resolveIndexedCreator({
    mint, providers: [{ name: "fixture", lookup: async () => [{ creator: "candidate" }] }],
    fetchTransaction: async () => { throw Error("must not be called"); },
  });
  assert.equal(result.status, "INDEXED_UNVERIFIED");
  assert.equal(result.creator, null);
});
test("unrelated creation transaction does not verify indexed wallet", async () => {
  const result = await resolveIndexedCreator({
    mint, providers: [{ name: "fixture", lookup: async () => [{ creator: "candidate", creationSignature: "signature" }] }],
    fetchTransaction: async () => ({ meta: { err: null }, transaction: { message: { instructions: [] } } }),
  });
  assert.equal(result.status, "INDEXED_UNVERIFIED");
});
test("provider failure cannot create false attribution", async () => {
  const result = await resolveIndexedCreator({
    mint, providers: [{ name: "fixture", lookup: async () => { throw Error("offline"); } }],
    fetchTransaction: async () => null,
  });
  assert.equal(result.status, "UNRESOLVED");
  assert.equal(result.failures[0].reason, "INDEX_LOOKUP_FAILED");
});

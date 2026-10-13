import test from "node:test";
import assert from "node:assert/strict";
import { verifyIndexedCreatorViaWallet } from "../lib/creatorWalletOriginCheck.mjs";
const mint = "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const creator = "6RKsroTt2NgJvyUyhUcKqANrpHwDw6eE52X9TMBsQ7WC";
const ts = 1789500020000;
test("unrelated wallet transaction never establishes creator", async () => {
  const result = await verifyIndexedCreatorViaWallet({
    mint, creator, createdTimestamp: ts,
    lookupSignaturePage: async () => ({ entries: [{ signature: "candidate", blockTime: Math.floor(ts/1000), err: null }], nextCursor: "candidate", exhausted: true }),
    fetchTransaction: async () => ({ meta: { err: null }, transaction: { message: { instructions: [] } } }),
  });
  assert.equal(result.status, "INDEXED_UNVERIFIED");
  assert.equal(result.creationSignature, null);
  assert.equal(result.retrieved, 1);
});
test("failed creation candidate never verifies creator", async () => {
  const result = await verifyIndexedCreatorViaWallet({
    mint, creator, createdTimestamp: ts,
    lookupSignaturePage: async () => ({ entries: [{ signature: "failed", blockTime: Math.floor(ts/1000), err: { InstructionError: [0,"Custom"] } }], nextCursor: "failed", exhausted: true }),
    fetchTransaction: async () => { throw Error("should not fetch failed signature"); },
  });
  assert.equal(result.status, "INDEXED_UNVERIFIED");
  assert.equal(result.inspected, 0);
});
test("missing timestamp rejects verification attempt", async () => {
  await assert.rejects(() => verifyIndexedCreatorViaWallet({
    mint, creator, createdTimestamp: null, lookupSignaturePage: async () => ({}), fetchTransaction: async () => null,
  }), /INVALID_TIMESTAMP/);
});

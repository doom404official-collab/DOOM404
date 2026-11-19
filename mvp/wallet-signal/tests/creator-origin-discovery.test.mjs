import test from "node:test";
import assert from "node:assert/strict";
import { discoverCreationCandidates } from "../lib/creatorOriginDiscovery.mjs";
const mint = "test-mint";
test("discovery returns candidates without asserting creator", async () => {
  const result = await discoverCreationCandidates({ mint, lookupSignatures: async () => ({ signatures: ["s1", "s1", "s2"], complete: true }), fetchTransaction: async () => ({ meta: { err: null } }) });
  assert.equal(result.status, "CANDIDATES_ONLY");
  assert.equal(result.candidates.length, 2);
  assert.equal(result.complete, true);
});
test("incomplete index is disclosed", async () => {
  const result = await discoverCreationCandidates({ mint, lookupSignatures: async () => ({ signatures: [], complete: false }), fetchTransaction: async () => null });
  assert.equal(result.reason, "HISTORY_INCOMPLETE");
});
test("provider errors do not become verified attribution", async () => {
  const result = await discoverCreationCandidates({ mint, lookupSignatures: async () => ({ signatures: ["s1"], complete: true }), fetchTransaction: async () => { throw Error("rate limited"); } });
  assert.equal(result.complete, false);
  assert.equal(result.unavailable, 1);
});
test("bounded scanning flags truncation", async () => {
  const result = await discoverCreationCandidates({ mint, maxCandidates: 1, lookupSignatures: async () => ({ signatures: ["s1", "s2"], complete: true }), fetchTransaction: async () => ({ meta: { err: null } }) });
  assert.equal(result.complete, false);
});

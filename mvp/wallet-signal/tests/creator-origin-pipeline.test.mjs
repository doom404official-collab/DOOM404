import test from "node:test";
import assert from "node:assert/strict";
import { resolvePumpFunCreator } from "../lib/creatorOriginPipeline.mjs";
test("no creation evidence yields unresolved", async () => {
  const result = await resolvePumpFunCreator({ mint: "mint", lookupSignatures: async () => ({ signatures: [], complete: false }), fetchTransaction: async () => null });
  assert.equal(result.status, "UNRESOLVED");
  assert.equal(result.historyComplete, false);
});
test("unrelated transactions never produce creator", async () => {
  const result = await resolvePumpFunCreator({ mint: "mint", lookupSignatures: async () => ({ signatures: ["sig"], complete: false }), fetchTransaction: async () => ({ meta: { err: null }, transaction: { message: { instructions: [{ programId: "other" }] } } }) });
  assert.equal(result.creator, null);
});

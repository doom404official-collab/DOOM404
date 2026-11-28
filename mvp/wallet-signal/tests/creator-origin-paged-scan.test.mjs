import test from "node:test";
import assert from "node:assert/strict";
import { scanCreatorOrigin } from "../lib/creatorOriginPagedScan.mjs";
const mint = "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
test("mid-page checkpoint resumes without losing unprocessed signatures", async () => {
  const all = ["sig5", "sig4", "sig3", "sig2", "sig1"];
  const lookupSignaturePage = async (_mint, { before } = {}) => {
    const start = before ? all.indexOf(before) + 1 : 0;
    const entries = all.slice(start, start + 5).map(signature => ({ signature, err: null }));
    return { entries, nextCursor: entries.at(-1)?.signature, exhausted: entries.length < 5 };
  };
  const fetchTransaction = async () => ({ meta: { err: null }, transaction: { message: { instructions: [] } } });
  const first = await scanCreatorOrigin({ mint, lookupSignaturePage, fetchTransaction, maxTransactions: 2 });
  assert.equal(first.nextCursor, "sig4");
  assert.equal(first.sampled, 2);
  const second = await scanCreatorOrigin({ mint, lookupSignaturePage, fetchTransaction, before: first.nextCursor, maxTransactions: 2 });
  assert.equal(second.nextCursor, "sig2");
  assert.equal(second.sampled, 2);
});
test("failed signatures are checkpointed without claiming creator", async () => {
  const result = await scanCreatorOrigin({
    mint, maxTransactions: 1,
    lookupSignaturePage: async () => ({ entries: [{ signature: "failed", err: { code: 1 } }, { signature: "valid", err: null }], nextCursor: "valid", exhausted: true }),
    fetchTransaction: async () => ({ meta: { err: null }, transaction: { message: { instructions: [] } } }),
  });
  assert.equal(result.sampled, 1);
  assert.equal(result.nextCursor, "valid");
  assert.equal(result.status, "UNRESOLVED");
});

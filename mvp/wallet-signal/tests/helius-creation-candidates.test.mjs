import test from "node:test";
import assert from "node:assert/strict";
import { createHeliusCreationCandidates } from "../lib/heliusCreationCandidates.mjs";
const mint = "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
test("indexed candidate discovery never asserts creator identity", async () => {
  let requested;
  const provider = createHeliusCreationCandidates({
    rpcUrl: "https://mainnet.helius-rpc.com/?api-key=PRIVATE_TEST",
    fetchImpl: async url => { requested = url; return { ok: true, json: async () => [{ signature: "2".repeat(70), feePayer: "not-a-creator", type: "UNKNOWN" }] }; },
  });
  const result = await provider.lookup(mint);
  assert.equal(result.length, 1);
  assert.equal(result[0].signature.length, 70);
  assert.equal(result[0].creator, undefined);
  assert.equal(requested.includes("sort-order=asc"), true);
});
test("rejects malformed index payload", async () => {
  const provider = createHeliusCreationCandidates({
    rpcUrl: "https://mainnet.helius-rpc.com/?api-key=PRIVATE_TEST",
    fetchImpl: async () => ({ ok: true, json: async () => ({ invalid: true }) }),
  });
  await assert.rejects(() => provider.lookup(mint), /HELIUS_INDEX_INVALID_RESPONSE/);
});

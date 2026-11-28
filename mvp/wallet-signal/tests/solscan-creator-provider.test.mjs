import test from "node:test";
import assert from "node:assert/strict";
import { createSolscanCreatorProvider } from "../lib/solscanCreatorProvider.mjs";
const mint = "98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";
const creator = "11111111111111111111111111111112";
const signature = "2".repeat(70);
test("maps documented creator and create_tx fields without exposing key", async () => {
  let header, url;
  const provider = createSolscanCreatorProvider({ apiKey: "TEST_SECRET", fetchImpl: async (u, opts) => {
    url = u; header = opts.headers.token;
    return { ok: true, json: async () => ({ success: true, data: { address: mint, creator, create_tx: signature } }) };
  } });
  const result = await provider.lookup(mint);
  assert.equal(result[0].creator, creator);
  assert.equal(result[0].creationSignature, signature);
  assert.equal(header, "TEST_SECRET");
  assert.equal(url.includes("TEST_SECRET"), false);
});
test("rejects metadata for a different mint", async () => {
  const provider = createSolscanCreatorProvider({ apiKey: "TEST_SECRET", fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, data: { address: "wrong", creator } }) }) });
  await assert.rejects(() => provider.lookup(mint), /SOLSCAN_INVALID_RESPONSE/);
});
test("does not infer creator from missing creator field", async () => {
  const provider = createSolscanCreatorProvider({ apiKey: "TEST_SECRET", fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, data: { address: mint, mint_authority: creator } }) }) });
  assert.deepEqual(await provider.lookup(mint), []);
});

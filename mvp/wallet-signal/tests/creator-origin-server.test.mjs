import test from "node:test";
import assert from "node:assert/strict";
import { resolvePumpFunCreatorFromEnvironment } from "../lib/creatorOriginServer.mjs";
test("missing secret is safely unresolved", async () => {
  const result = await resolvePumpFunCreatorFromEnvironment({ mint: "mint", env: {} });
  assert.equal(result.status, "UNRESOLVED");
  assert.equal(result.reason, "HELIUS_RPC_URL_NOT_CONFIGURED");
});
test("configured URL is used server-side without leaking it", async () => {
  const secret = "https://example.test/?api-key=PRIVATE_TEST_KEY";
  const urls = [];
  const result = await resolvePumpFunCreatorFromEnvironment({
    mint: "mint", env: { HELIUS_RPC_URL: secret },
    fetchImpl: async (url) => { urls.push(url); return { ok: true, json: async () => ({ result: [] }) }; },
  });
  assert.deepEqual(urls, [secret]);
  assert.equal(JSON.stringify(result).includes("PRIVATE_TEST_KEY"), false);
  assert.equal(result.status, "UNRESOLVED");
});

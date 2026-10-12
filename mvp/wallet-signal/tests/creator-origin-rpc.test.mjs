import test from "node:test";
import assert from "node:assert/strict";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
test("RPC discovery never claims archival completeness", async () => {
  const calls = [];
  const adapter = createSolanaRpcAdapter({ rpcUrl: "https://example.test", pageLimit: 2, fetchImpl: async (_url, opts) => {
    const body = JSON.parse(opts.body); calls.push(body);
    return { ok: true, json: async () => ({ result: body.method === "getSignaturesForAddress" ? [{ signature: "s1", err: null }] : null }) };
  } });
  const result = await adapter.lookupSignatures("mint");
  assert.deepEqual(result.signatures, ["s1"]);
  assert.equal(result.complete, false);
  assert.equal(result.rpcHistoryExhausted, true);
  assert.equal(calls[0].method, "getSignaturesForAddress");
});
test("transaction fetch requests finalized versioned parsed transaction", async () => {
  let params;
  const adapter = createSolanaRpcAdapter({ rpcUrl: "https://example.test", fetchImpl: async (_url, opts) => {
    const body = JSON.parse(opts.body); params = body.params;
    return { ok: true, json: async () => ({ result: { meta: { err: null } } }) };
  } });
  await adapter.fetchTransaction("sig");
  assert.equal(params[1].maxSupportedTransactionVersion, 0);
});
test("provider RPC errors propagate rather than becoming attribution", async () => {
  const adapter = createSolanaRpcAdapter({ rpcUrl: "https://example.test", fetchImpl: async () => ({ ok: true, json: async () => ({ error: { code: -32000 } }) }) });
  await assert.rejects(() => adapter.lookupSignatures("mint"), /RPC_RESPONSE_ERROR/);
});

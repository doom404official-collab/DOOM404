import test from "node:test";
import assert from "node:assert/strict";
import { createSolanaRpcClient, RpcRequestError } from "../src/lib/solanaRpc.js";

const ok = (result) => ({ ok: true, json: async () => ({ jsonrpc: "2.0", result }) });
const http = (status) => ({ ok: false, status });
const endpoints = ["https://primary.example", "https://fallback.example"];
const client = (fetchImpl, opts = {}) => createSolanaRpcClient({
  endpoints, fetchImpl, retriesPerEndpoint: 0, backoffMs: 0, ...opts,
});

test("returns successful RPC result", async () => {
  const rpc = client(async () => ok({ value: 42 }));
  assert.deepEqual(await rpc.call("getBalance", ["wallet"]), { value: 42 });
});

test("fails over from 429 to secondary endpoint", async () => {
  const calls = [];
  const rpc = client(async (url) => { calls.push(url); return url === endpoints[0] ? http(429) : ok("ready"); });
  assert.equal(await rpc.call("getHealth"), "ready");
  assert.deepEqual(calls, endpoints);
});

test("fails over from 5xx", async () => {
  const rpc = client(async (url) => url === endpoints[0] ? http(503) : ok("ready"));
  assert.equal(await rpc.call("getHealth"), "ready");
});

test("does not retry invalid method or params", async () => {
  let calls = 0;
  const rpc = client(async () => { calls++; return { ok: true, json: async () => ({ jsonrpc: "2.0", error: { code: -32602 } }) }; });
  await assert.rejects(rpc.call("badMethod"), RpcRequestError);
  assert.equal(calls, 1);
});

test("reports all endpoints unavailable", async () => {
  const rpc = client(async () => { throw new TypeError("network down"); });
  await assert.rejects(rpc.call("getHealth"), /All configured RPC endpoints failed/);
});

test("rejects insecure endpoints", () => {
  assert.throws(() => createSolanaRpcClient({ endpoints: ["http://localhost:8899"] }), TypeError);
});

test("times out and fails over", async () => {
  const rpc = client((url, options) => url === endpoints[0]
    ? new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true }))
    : Promise.resolve(ok("ready")), { timeoutMs: 10 });
  assert.equal(await rpc.call("getHealth"), "ready");
});

/**
 * DOOM404 Wallet Signal — resilient, read-only Solana JSON-RPC transport.
 * Framework-independent; integrate after identifying the deployed app entrypoint.
 * Never place private RPC API keys in client-side endpoint URLs.
 */
export class RpcRequestError extends Error {
  constructor(message, { code, endpoint, retryable = false } = {}) {
    super(message);
    this.name = "RpcRequestError";
    this.code = code;
    this.endpoint = endpoint;
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSolanaRpcClient({
  endpoints,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
  retriesPerEndpoint = 1,
  backoffMs = 350,
} = {}) {
  if (!Array.isArray(endpoints) || endpoints.length === 0 ||
      !endpoints.every((url) => typeof url === "string" && /^https:\/\//.test(url))) {
    throw new TypeError("Provide at least one HTTPS Solana RPC endpoint.");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
  if (!Number.isInteger(retriesPerEndpoint) || retriesPerEndpoint < 0 || retriesPerEndpoint > 5)
    throw new RangeError("retriesPerEndpoint must be between 0 and 5");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new RangeError("timeoutMs must be positive");

  let requestId = 0;

  async function call(method, params = []) {
    if (typeof method !== "string" || !method || !Array.isArray(params))
      throw new TypeError("Invalid JSON-RPC method or params");
    let lastError;
    for (const endpoint of endpoints) {
      for (let attempt = 0; attempt <= retriesPerEndpoint; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
            signal: controller.signal,
          });
          if (!response.ok) {
            const retryable = response.status === 429 || response.status >= 500;
            throw new RpcRequestError("RPC HTTP " + response.status, {
              code: response.status, endpoint, retryable,
            });
          }
          const payload = await response.json();
          if (!payload || payload.jsonrpc !== "2.0" || !Object.prototype.hasOwnProperty.call(payload, "result")) {
            const code = payload?.error?.code;
            // Invalid params/method errors are not fixed by retrying on another endpoint.
            const retryable = code === -32005 || code === -32004 || (typeof code === "number" && code <= -32000 && code > -32099);
            throw new RpcRequestError("RPC returned an error or invalid result", { code, endpoint, retryable });
          }
          return payload.result;
        } catch (error) {
          const retryable = error instanceof RpcRequestError
            ? error.retryable
            : error?.name === "AbortError" || error instanceof TypeError;
          lastError = error instanceof RpcRequestError ? error :
            new RpcRequestError(error?.name === "AbortError" ? "RPC timed out" : "RPC network failure", {
              endpoint, retryable,
            });
          if (!retryable) throw lastError;
          if (attempt < retriesPerEndpoint) await sleep(backoffMs * 2 ** attempt);
        } finally {
          clearTimeout(timeout);
        }
      }
    }
    throw new RpcRequestError("All configured RPC endpoints failed", {
      code: lastError?.code, retryable: true,
    });
  }

  return { call };
}

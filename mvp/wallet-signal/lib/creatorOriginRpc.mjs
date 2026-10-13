/**
 * Read-only Solana RPC adapter. Supply a server-side RPC URL from environment.
 * Standard RPC pagination is NOT proof of complete archival coverage.
 */
export function createSolanaRpcAdapter({ rpcUrl, fetchImpl = fetch, pageLimit = 1000, maxRequests = 100, maxRetries = 2, minIntervalMs = 250, sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!rpcUrl || !/^https:\/\//.test(rpcUrl)) throw new TypeError("HTTPS rpcUrl required");
  if (!Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 1000) throw new RangeError("invalid pageLimit");
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 1000) throw new RangeError("invalid maxRequests");
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) throw new RangeError("invalid maxRetries");
  if (!Number.isInteger(minIntervalMs) || minIntervalMs < 0 || minIntervalMs > 5000) throw new RangeError("invalid minIntervalMs");
  let requestId = 0, lastRequestAt = 0;
  async function rpc(method, params) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (requestId >= maxRequests) throw new Error("RPC_REQUEST_BUDGET_EXHAUSTED");
      const wait = Math.max(0, minIntervalMs - (Date.now() - lastRequestAt));
      if (wait) await sleep(wait);
      lastRequestAt = Date.now();
      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
        cache: "no-store",
      });
      if (response.status === 429) {
        if (attempt === maxRetries) throw new Error("RPC_RATE_LIMITED");
        const raw = response.headers?.get?.("retry-after");
        const seconds = raw && /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
        const date = raw && !Number.isFinite(seconds) ? Date.parse(raw) : NaN;
        const retryMs = Number.isFinite(seconds) ? seconds * 1000 :
          Number.isFinite(date) ? Math.max(0, date - Date.now()) : 500 * 2 ** attempt;
        if (retryMs > 10000) throw new Error("RPC_RETRY_AFTER_TOO_LONG");
        await sleep(Math.max(250, retryMs));
        continue;
      }
      if (!response.ok) throw new Error([401,403].includes(response.status) ? "RPC_AUTH_FAILED" : "RPC_HTTP_ERROR");
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error.code === -32015 ? "RPC_UNSUPPORTED_VERSION" : "RPC_RESPONSE_ERROR");
      return payload.result;
    }
    throw new Error("RPC_RATE_LIMITED");
  }
  return {
    async lookupSignaturePage(mint, { before } = {}) {
      const config = { limit: pageLimit, commitment: "finalized" };
      if (before) config.before = before;
      const batch = await rpc("getSignaturesForAddress", [mint, config]);
      if (!Array.isArray(batch)) throw new Error("INVALID_SIGNATURE_RESPONSE");
      return { entries: batch, nextCursor: batch.at(-1)?.signature || null, exhausted: batch.length < pageLimit };
    },
    async lookupSignatures(mint, { maxPages = 3 } = {}) {
      if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new RangeError("invalid maxPages");
      const signatures = [];
      let before;
      let exhausted = false;
      let pagesFetched = 0;
      let rawSignaturesSeen = 0;
      let failedSignaturesSkipped = 0;
      for (let page = 0; page < maxPages; page++) {
        const config = { limit: pageLimit, commitment: "finalized" };
        if (before) config.before = before;
        const batch = await rpc("getSignaturesForAddress", [mint, config]);
        if (!Array.isArray(batch)) throw new Error("INVALID_SIGNATURE_RESPONSE");
        pagesFetched++;
        rawSignaturesSeen += batch.length;
        failedSignaturesSkipped += batch.filter((item) => item?.err != null).length;
        signatures.push(...batch.filter((s) => s && !s.err && typeof s.signature === "string").map((s) => s.signature));
        if (batch.length < pageLimit) { exhausted = true; break; }
        const last = batch.at(-1)?.signature;
        if (!last || last === before) throw new Error("RPC_PAGINATION_STALLED");
        before = last;
      }
      // Even an exhausted RPC history may be pruned; never assert archive completeness.
      return { signatures, complete: false, rpcHistoryExhausted: exhausted, pagesFetched, rawSignaturesSeen, failedSignaturesSkipped, paginationLimitReached: !exhausted };
    },
    fetchTransaction(signature) {
      return rpc("getTransaction", [signature, { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 1 }]);
    },
  };
}

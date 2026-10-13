/**
 * Helius getTransactionsForAddress — time-filtered oldest-first signatures.
 * Uses existing server-side RPC URL. This is a bounded discovery adapter;
 * provider availability and archival coverage are not assumed.
 */
export function createHeliusTimedHistory({ rpcUrl, fetchImpl = fetch } = {}) {
  if (!rpcUrl || !/^https:\/\//.test(rpcUrl)) throw Error("HTTPS_RPC_URL_REQUIRED");
  const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return {
    async lookup({ address, createdTimestamp, windowSeconds = 7200, limit = 30 } = {}) {
      if (!valid.test(address || "")) throw Error("INVALID_ADDRESS");
      if (!Number.isFinite(createdTimestamp) || createdTimestamp <= 0) throw Error("INVALID_TIMESTAMP");
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
          !Number.isInteger(windowSeconds) || windowSeconds < 60 || windowSeconds > 86400) throw Error("INVALID_LIMIT");
      const epoch = createdTimestamp > 1e12 ? Math.floor(createdTimestamp / 1000) : Math.floor(createdTimestamp);
      let response;
      try {
        response = await fetchImpl(rpcUrl, {
          method: "POST", cache: "no-store", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransactionsForAddress",
            params: [address, { transactionDetails: "signatures", sortOrder: "asc", limit,
              filters: { blockTime: { gte: epoch-windowSeconds, lte: epoch+windowSeconds },
                status: "succeeded" } }] }),
          signal: AbortSignal.timeout(12000),
        });
      } catch { throw Error("HELIUS_TIMED_NETWORK_ERROR"); }
      if (!response.ok) throw Error([401,403].includes(response.status) ? "HELIUS_TIMED_AUTH_FAILED"
        : response.status === 429 ? "HELIUS_TIMED_RATE_LIMITED" : "HELIUS_TIMED_HTTP_ERROR");
      let body;
      try { body = await response.json(); } catch { throw Error("HELIUS_TIMED_INVALID_JSON"); }
      if (body?.error) throw Error(body.error.code === -32601 ? "HELIUS_TIMED_METHOD_UNAVAILABLE" : "HELIUS_TIMED_RPC_ERROR");
      const result = body?.result;
      if (!result || !Array.isArray(result.transactions)) {
        // Only a fixed, non-sensitive schema diagnostic; never print provider payloads.
        const shape = Array.isArray(result) ? "RESULT_ARRAY" : result === null ? "RESULT_NULL" :
          typeof result === "object" ? "RESULT_OBJECT_WITHOUT_TRANSACTIONS" : "RESULT_MISSING_OR_SCALAR";
        throw Error("HELIUS_TIMED_" + shape);
      }
      const signatures = result.transactions.map(t => typeof t === "string" ? t : t?.signature)
        .filter(s => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(s));
      return { signatures, paginationToken: typeof result.paginationToken === "string" ? result.paginationToken : null,
        historyComplete: false };
    },
  };
}

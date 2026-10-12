/** Pump.fun published coin-data endpoint. Indexed creator is a candidate, not on-chain proof. */
export function createPumpFunIndexedCreatorProvider({ fetchImpl = fetch } = {}) {
  return {
    name: "pumpfun-coin-data",
    async lookup(mint) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || "")) throw new Error("INVALID_MINT");
      let response;
      try {
        response = await fetchImpl("https://frontend-api-v3.pump.fun/coins-v2/" + mint, {
          headers: { accept: "application/json" }, cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
      } catch { throw new Error("PUMPFUN_NETWORK_ERROR"); }
      if (!response.ok) throw new Error([401,403].includes(response.status) ? "PUMPFUN_ACCESS_DENIED"
        : response.status === 429 ? "PUMPFUN_RATE_LIMITED"
        : response.status === 404 ? "PUMPFUN_TOKEN_NOT_FOUND" : "PUMPFUN_HTTP_ERROR");
      let payload;
      try { payload = await response.json(); } catch { throw new Error("PUMPFUN_INVALID_JSON"); }
      if (!payload || payload.mint !== mint) throw new Error("PUMPFUN_MINT_MISMATCH");
      if (typeof payload.creator !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payload.creator)) return [];
      return [{ creator: payload.creator, creatorRole: "pumpfun_indexed_creator",
        creationSignature: null, createdTimestamp: Number.isSafeInteger(payload.created_timestamp) ? payload.created_timestamp : null }];
    },
  };
}

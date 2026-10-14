/** Solscan Pro v2 documented token metadata: creator + create_tx. Server-only. */
export function createSolscanCreatorProvider({ apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey || typeof apiKey !== "string") throw new Error("SOLSCAN_API_KEY_NOT_CONFIGURED");
  return {
    name: "solscan-pro-v2",
    async lookup(mint) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || "")) throw new Error("INVALID_MINT");
      const url = new URL("https://pro-api.solscan.io/v2.0/token/meta");
      url.searchParams.set("address", mint);
      let response;
      try { response = await fetchImpl(url.toString(), {
        method: "GET", redirect: "error", headers: { token: apiKey, accept: "application/json" }, cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }); } catch { throw new Error("SOLSCAN_NETWORK_ERROR"); }
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? "SOLSCAN_AUTH_FAILED" : response.status === 429 ? "SOLSCAN_RATE_LIMITED" : "SOLSCAN_HTTP_ERROR");
      let payload;
      try { payload = await response.json(); } catch { throw new Error("SOLSCAN_RESPONSE_NOT_JSON"); }
      if (payload?.success !== true) throw new Error("SOLSCAN_API_REJECTED");
      if (!payload.data || payload.data.address !== mint) throw new Error("SOLSCAN_INVALID_RESPONSE");
      const { creator, create_tx } = payload.data;
      if (typeof creator !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator)) return [];
      return [{
        creator, creatorRole: "solscan_token_creator_label",
        creationSignature: typeof create_tx === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(create_tx) ? create_tx : null,
      }];
    },
  };
}

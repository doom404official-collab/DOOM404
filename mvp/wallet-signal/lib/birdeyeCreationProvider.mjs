/**
 * Optional Birdeye indexed creation-info adapter.
 * Never use a generic owner, payer, or authority field as proof of creator.
 * Field mapping must be confirmed against an actual provider response before activation.
 */
export function createBirdeyeCreationProvider({ apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error("BIRDEYE_API_KEY_NOT_CONFIGURED");
  return {
    name: "birdeye-creation-info",
    async lookup(mint) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || "")) throw new Error("INVALID_MINT");
      const url = new URL("https://public-api.birdeye.so/defi/token_creation_info");
      url.searchParams.set("address", mint);
      let response;
      try {
        response = await fetchImpl(url.toString(), {
          headers: { "X-API-KEY": apiKey, "x-chain": "solana", accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
      } catch { throw new Error("BIRDEYE_NETWORK_ERROR"); }
      if (!response.ok) throw new Error([401, 403].includes(response.status)
        ? "BIRDEYE_AUTH_FAILED" : response.status === 429 ? "BIRDEYE_RATE_LIMITED" : "BIRDEYE_HTTP_ERROR");
      let payload;
      try { payload = await response.json(); } catch { throw new Error("BIRDEYE_INVALID_JSON"); }
      if (payload?.success !== true || !payload?.data) throw new Error("BIRDEYE_INVALID_RESPONSE");
      // Fail closed until the actual response schema has been audited.
      // This deliberately does not guess field names or creator roles.
      return [];
    },
  };
}

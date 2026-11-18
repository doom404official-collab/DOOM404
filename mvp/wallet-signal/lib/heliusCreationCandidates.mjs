/**
 * Helius enhanced-history discovery. This returns transaction-signature
 * candidates, NOT a verified token-to-creator database record.
 * Uses existing server-side HELIUS_RPC_URL solely to extract its API key.
 */
export function createHeliusCreationCandidates({ rpcUrl, fetchImpl = fetch } = {}) {
  const endpoint = new URL(rpcUrl || "https://invalid.local");
  if (endpoint.protocol !== "https:" || !["mainnet.helius-rpc.com", "api-mainnet.helius-rpc.com"].includes(endpoint.hostname))
    throw new Error("INVALID_HELIUS_ENDPOINT");
  const key = endpoint.searchParams.get("api-key");
  if (!key) throw new Error("HELIUS_KEY_NOT_CONFIGURED");
  return {
    name: "helius-enhanced-history",
    async lookup(mint) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || "")) throw new Error("INVALID_MINT");
      const url = new URL("https://api-mainnet.helius-rpc.com/v0/addresses/" + mint + "/transactions");
      url.searchParams.set("api-key", key);
      url.searchParams.set("limit", "25");
      // This endpoint is not assumed to support oldest-first ordering.
      let response;
      try {
        response = await fetchImpl(url.toString(), { headers: { accept: "application/json" },
          cache: "no-store", signal: AbortSignal.timeout(12000) });
      } catch { throw new Error("HELIUS_INDEX_NETWORK_ERROR"); }
      if (!response.ok) throw new Error([401,403].includes(response.status) ? "HELIUS_INDEX_AUTH_FAILED"
        : response.status === 429 ? "HELIUS_INDEX_RATE_LIMITED" : "HELIUS_INDEX_HTTP_ERROR");
      let rows;
      try { rows = await response.json(); } catch { throw new Error("HELIUS_INDEX_INVALID_JSON"); }
      if (!Array.isArray(rows)) throw new Error("HELIUS_INDEX_INVALID_RESPONSE");
      // Only signatures are candidates. Never infer creator from feePayer, source, or transfers.
      return rows.filter(r => r && typeof r.signature === "string" && r.signature.length >= 64)
        .slice(0,25).map(r => ({ signature: r.signature, source: r.source || null, type: r.type || null }));
    },
  };
}

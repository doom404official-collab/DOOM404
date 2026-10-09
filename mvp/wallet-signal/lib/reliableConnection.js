import { Connection } from "@solana/web3.js";

/**
 * Server-side Solana RPC connection with bounded retry, timeout and failover.
 * SOLANA_RPC_URL and SOLANA_RPC_FALLBACK_URLS are server-only environment variables.
 * Never expose provider credentials through NEXT_PUBLIC_ variables.
 */
export function createReliableConnection({
  primary = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  fallbacks = process.env.SOLANA_RPC_FALLBACK_URLS || "",
  timeoutMs = 8000,
  retries = 1,
  fetchImpl = fetch
} = {}) {
  const endpoints = [...new Set([primary, ...fallbacks.split(",").map((x) => x.trim())].filter(Boolean))];
  if (!endpoints.length || !endpoints.every((url) => /^https:\/\//i.test(url))) {
    throw new Error("RPC endpoints must use HTTPS");
  }
  async function resilientFetch(_url, init = {}) {
    let lastError;
    for (const endpoint of endpoints) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const onAbort = () => controller.abort();
        if (init.signal?.aborted) controller.abort();
        init.signal?.addEventListener?.("abort", onAbort, { once: true });
        try {
          const response = await fetchImpl(endpoint, { ...init, signal: controller.signal });
          if (response.ok) {
            // JSON-RPC errors can arrive with HTTP 200. Retry only transient server errors.
            const payload = await response.clone().json();
            const code = payload?.error?.code;
            if (code === -32005 || code === -32004) {
              lastError = new Error("Transient Solana RPC error " + code);
            } else {
              return response;
            }
          } else if (response.status === 429 || response.status >= 500) {
            lastError = new Error("Solana RPC HTTP " + response.status);
          } else {
            return response; // permanent HTTP error: preserve for web3.js
          }
        } catch (error) {
          if (init.signal?.aborted) throw error;
          lastError = error;
        } finally {
          clearTimeout(timeout);
          init.signal?.removeEventListener?.("abort", onAbort);
        }
        if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt));
      }
    }
    throw new Error("Solana RPC unavailable after retry and fallback", { cause: lastError });
  }
  return new Connection(primary, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
    fetch: resilientFetch
  });
}

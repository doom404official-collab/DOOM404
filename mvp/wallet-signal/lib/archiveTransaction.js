// Read-only archive transaction retrieval. Never expose provider credentials in returned diagnostics.
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
export async function fetchArchivedTransaction(signature, { endpoint, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (!SIGNATURE.test(signature || "")) return { status: "invalid_signature" };
  if (!endpoint || !/^https:\/\//.test(endpoint)) return { status: "not_configured" };
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction",
        params: [signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }] }),
      signal: AbortSignal.timeout(timeoutMs), cache: "no-store"
    });
    if (!response.ok) return { status: "provider_error", httpStatus: response.status };
    const payload = await response.json();
    if (payload.error) return { status: "provider_error", rpcCode: payload.error.code ?? null };
    const tx = payload.result;
    if (!tx) return { status: "transaction_unavailable" };
    if (tx.meta?.err) return { status: "failed_transaction" };
    if (!tx.transaction?.message || !Array.isArray(tx.transaction?.signatures) || !tx.transaction.signatures.includes(signature))
      return { status: "invalid_transaction_response" };
    return { status: "transaction_retrieved", transaction: tx, provider: "configured_archive_rpc" };
  } catch (error) {
    return { status: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "provider_error" };
  }
}

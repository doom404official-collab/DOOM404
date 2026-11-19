/**
 * Historical signature discovery adapter.
 * The caller supplies an archive-capable signature index; no API credentials are stored here.
 * Index responses are untrusted candidate references, not proof of creator identity.
 */
export async function discoverCreationCandidates({
  mint,
  lookupSignatures,
  fetchTransaction,
  maxCandidates = 100,
} = {}) {
  if (typeof mint !== "string" || !mint.trim()) throw new TypeError("mint is required");
  if (typeof lookupSignatures !== "function" || typeof fetchTransaction !== "function") {
    throw new TypeError("lookupSignatures and fetchTransaction functions are required");
  }
  if (!Number.isSafeInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 1000) {
    throw new RangeError("maxCandidates must be between 1 and 1000");
  }
  const response = await lookupSignatures(mint);
  if (!response || !Array.isArray(response.signatures)) {
    return { mint, status: "UNRESOLVED", reason: "INVALID_INDEX_RESPONSE", candidates: [], complete: false };
  }
  const complete = response.complete === true;
  const unique = [...new Set(response.signatures.filter((s) => typeof s === "string" && s.length > 0))];
  const candidates = [];
  let unavailable = 0;
  for (const signature of unique.slice(0, maxCandidates)) {
    try {
      const tx = await fetchTransaction(signature);
      if (!tx || tx.meta?.err != null) continue;
      candidates.push({ signature, transaction: tx });
    } catch {
      unavailable++;
    }
  }
  const truncated = unique.length > maxCandidates;
  return {
    mint,
    status: "CANDIDATES_ONLY",
    reason: !complete || truncated || unavailable ? "HISTORY_INCOMPLETE" : null,
    candidates,
    complete: complete && !truncated && unavailable === 0,
    inspected: Math.min(unique.length, maxCandidates),
    unavailable,
  };
}

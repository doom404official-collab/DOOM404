import { fetchArchivedTransaction } from "./archiveTransaction.js";
import { resolveCreatorRole } from "./creatorOriginResolver.js";

// Given independently discovered oldest-first signatures, retrieve full
// transactions from an archive-capable endpoint. A signature is a candidate,
// not proof of the creation transaction or creator identity.
export async function investigateIndexedOrigin({ mint, signatures, archiveEndpoint, fetchImpl = fetch, maxCandidates = 12 } = {}) {
  const rows = Array.isArray(signatures) ? signatures : [];
  const unique = [...new Set(rows.filter(x => typeof x === "string"))].slice(0, Math.max(0, Math.min(30, maxCandidates)));
  const attempts = [];
  for (const signature of unique) {
    const fetched = await fetchArchivedTransaction(signature, { endpoint: archiveEndpoint, fetchImpl });
    if (fetched.status !== "transaction_retrieved") {
      attempts.push({ signature, status: fetched.status });
      continue;
    }
    const attribution = resolveCreatorRole({ mint, transaction: fetched.transaction });
    attempts.push({ signature, status: attribution.status, reason: attribution.reason || null });
    if (attribution.status === "verified_role" || attribution.status === "conflict") {
      return { ...attribution, attempts, historyComplete: false, retrievalSource: "archive_rpc" };
    }
  }
  return { status: "unresolved", reason: unique.length ? "No audited creator role established from retrieved candidate transactions" : "No indexed candidate signatures supplied",
    attempts, historyComplete: false, candidatesExamined: unique.length };
}

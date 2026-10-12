import { verifyLaunchpadCreation } from "./launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "./pumpFunCreation.mjs";

/**
 * Bounded, resumable evidence search. Does not assert complete archive coverage.
 * Checkpoints are public signatures only; never persist provider credentials.
 */
export async function scanCreatorOrigin({
  mint, lookupSignaturePage, fetchTransaction, before = null,
  maxPages = 5, maxTransactions = 25, maxDurationMs = 20000,
} = {}) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint || "")) throw Error("INVALID_MINT");
  if (typeof lookupSignaturePage !== "function" || typeof fetchTransaction !== "function") throw Error("MISSING_ADAPTER");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20 ||
      !Number.isInteger(maxTransactions) || maxTransactions < 1 || maxTransactions > 100 ||
      !Number.isInteger(maxDurationMs) || maxDurationMs < 1000 || maxDurationMs > 120000) throw Error("INVALID_LIMIT");
  const started = Date.now();
  let cursor = before, pagesFetched = 0, rawSignaturesSeen = 0, failedSignaturesSkipped = 0;
  let retrieved = 0, unavailable = 0, fetchErrors = 0, exhausted = false;
  const seen = new Set(), candidates = [], verified = [], failureReasons = {};
  for (let page = 0; page < maxPages; page++) {
    if (Date.now() - started >= maxDurationMs) break;
    const batch = await lookupSignaturePage(mint, { before: cursor });
    if (!batch || !Array.isArray(batch.entries)) throw Error("INVALID_SIGNATURE_PAGE");
    pagesFetched++;
    rawSignaturesSeen += batch.entries.length;
    failedSignaturesSkipped += batch.entries.filter(e => e?.err != null).length;
    // RPC returns newest to oldest. Process in that order so a mid-page checkpoint cannot skip entries.
    let consumedEntirePage = true;
    for (const entry of batch.entries) {
      if (candidates.length >= maxTransactions || Date.now() - started >= maxDurationMs) { consumedEntirePage = false; break; }
      if (!entry || typeof entry.signature !== "string") { consumedEntirePage = false; break; }
      if (seen.has(entry.signature)) { consumedEntirePage = false; break; }
      cursor = entry.signature;
      if (entry.err != null) continue;
      seen.add(entry.signature);
      candidates.push(entry.signature);
      try {
        const tx = await fetchTransaction(entry.signature);
        if (!tx || tx.meta?.err != null) { unavailable++; continue; }
        retrieved++;
        const proof = verifyLaunchpadCreation({ mint, signature: entry.signature, transaction: tx, decoders: pumpFunDecoders });
        if (proof.status === "VERIFIED") verified.push(...proof.decodedRoles.map(role => ({
          signature: entry.signature, creator: role.address, programId: role.programId, decoderVersion: role.decoderVersion
        })));
      } catch (error) {
        fetchErrors++;
        const allowed = ["RPC_RATE_LIMITED", "RPC_AUTH_FAILED", "RPC_HTTP_ERROR", "RPC_UNSUPPORTED_VERSION", "RPC_RESPONSE_ERROR"];
        const reason = allowed.includes(error?.message) ? error.message : "TRANSACTION_FETCH_EXCEPTION";
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }
    }
    if (!consumedEntirePage) break;
    const next = batch.nextCursor;
    if (batch.exhausted === true) { exhausted = true; break; }
    if (!next || next !== cursor || seen.has("cursor:" + next)) throw Error("PAGINATION_STALLED");
    seen.add("cursor:" + next);
    if (verified.length || candidates.length >= maxTransactions) break;
  }
  const creators = [...new Set(verified.map(p => p.creator))];
  return {
    mint, status: creators.length === 1 ? "CANDIDATE_VERIFIED_NEEDS_INDEPENDENT_REVIEW" : "UNRESOLVED",
    reason: creators.length > 1 ? "CONFLICTING_CREATOR_EVIDENCE" : creators.length === 0 ? "NO_VERIFIED_CREATION_IN_SAMPLE" : null,
    creator: creators.length === 1 ? creators[0] : null,
    verified: creators.length === 1 ? verified : [],
    pagesFetched, rawSignaturesSeen, failedSignaturesSkipped, sampled: candidates.length, sampledSignatures: candidates,
    retrieved, unavailable, fetchErrors, failureReasons, rpcHistoryExhausted: exhausted,
    historyComplete: false, nextCursor: cursor, resumeRequired: !exhausted && creators.length === 0,
  };
}

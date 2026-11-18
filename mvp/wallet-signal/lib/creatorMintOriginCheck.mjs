import { verifyLaunchpadCreation } from "./launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "./pumpFunCreation.mjs";

/**
 * Bounded mint-address history verification near an indexed creation timestamp.
 * RPC pages are newest first. Skip newer signatures without fetching transactions.
 * No creator attribution unless decoded on-chain instruction matches indexed creator.
 */
export async function verifyIndexedCreatorViaMint({
  mint, indexedCreator, createdTimestamp, lookupSignaturePage, fetchTransaction,
  before = null, maxPages = 12, maxTransactions = 30, windowSeconds = 7200,
} = {}) {
  const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!valid.test(mint || "") || !valid.test(indexedCreator || "")) throw Error("INVALID_ADDRESS");
  if (typeof lookupSignaturePage !== "function" || typeof fetchTransaction !== "function") throw Error("MISSING_RPC");
  if (!Number.isFinite(createdTimestamp) || createdTimestamp <= 0) throw Error("INVALID_TIMESTAMP");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 30 ||
      !Number.isInteger(maxTransactions) || maxTransactions < 1 || maxTransactions > 100 ||
      !Number.isInteger(windowSeconds) || windowSeconds < 60 || windowSeconds > 86400) throw Error("INVALID_LIMIT");
  const epoch = createdTimestamp > 1e12 ? Math.floor(createdTimestamp / 1000) : Math.floor(createdTimestamp);
  const minTime = epoch - windowSeconds, maxTime = epoch + windowSeconds;
  let cursor = before, pagesFetched = 0, rawSignaturesSeen = 0, newerThanWindow = 0;
  let failedSignatures = 0, missingBlockTime = 0, inspected = 0, retrieved = 0, errors = 0;
  let reachedOlderHistory = false, historyExhausted = false, limitReached = false;
  const inspectedSignatures = [], evidence = [], seenCursors = new Set();
  outer: for (let page = 0; page < maxPages; page++) {
    const batch = await lookupSignaturePage(mint, { before: cursor });
    if (!batch || !Array.isArray(batch.entries)) throw Error("INVALID_SIGNATURE_PAGE");
    pagesFetched++;
    rawSignaturesSeen += batch.entries.length;
    for (const entry of batch.entries) {
      if (!entry || typeof entry.signature !== "string") throw Error("INVALID_SIGNATURE_ENTRY");
      // Stop before consuming the next eligible signature if transaction budget is spent.
      const eligible = entry.err == null && Number.isFinite(entry.blockTime) &&
        entry.blockTime >= minTime && entry.blockTime <= maxTime;
      if (eligible && inspected >= maxTransactions) { limitReached = true; break outer; }
      cursor = entry.signature;
      if (entry.err != null) { failedSignatures++; continue; }
      if (!Number.isFinite(entry.blockTime)) { missingBlockTime++; continue; }
      if (entry.blockTime > maxTime) { newerThanWindow++; continue; }
      if (entry.blockTime < minTime) { reachedOlderHistory = true; break outer; }
      inspected++;
      inspectedSignatures.push(entry.signature);
      try {
        const tx = await fetchTransaction(entry.signature);
        if (!tx || tx.meta?.err != null) continue;
        retrieved++;
        const proof = verifyLaunchpadCreation({
          mint, signature: entry.signature, transaction: tx, decoders: pumpFunDecoders,
        });
        if (proof.status === "VERIFIED" && proof.decodedRoles.some(r => r.address === indexedCreator)) {
          evidence.push({ signature: entry.signature, creator: indexedCreator,
            programId: proof.decodedRoles[0].programId, decoderVersion: proof.decodedRoles[0].decoderVersion });
          break outer;
        }
      } catch { errors++; }
    }
    if (batch.exhausted) { historyExhausted = true; break; }
    if (!batch.nextCursor || batch.nextCursor !== cursor || seenCursors.has(cursor))
      throw Error("PAGINATION_STALLED");
    seenCursors.add(cursor);
    if (page === maxPages - 1) limitReached = true;
  }
  return {
    mint, indexedCreator,
    status: evidence.length ? "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW" : "INDEXED_UNVERIFIED",
    creationSignature: evidence[0]?.signature || null, evidence, pagesFetched, rawSignaturesSeen,
    newerThanWindow, failedSignatures, missingBlockTime, inspected, retrieved, errors,
    reachedOlderHistory, historyExhausted, limitReached,
    nextCursor: cursor, resumeRequired: !evidence.length && !reachedOlderHistory && !historyExhausted,
    inspectedSignatures,
  };
}

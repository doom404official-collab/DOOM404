/**
 * Portable, versioned checkpoint for a bounded creator-origin investigation.
 * Storage is injected by the caller; this module never writes secrets or
 * assumes Vercel's ephemeral filesystem is durable.
 */
const address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const signature = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
export function newCreatorCheckpoint({ mint, indexedCreator, createdTimestamp }) {
  if (!address.test(mint || "") || !address.test(indexedCreator || "") ||
      !Number.isSafeInteger(createdTimestamp) || createdTimestamp <= 0) throw Error("INVALID_CHECKPOINT_INPUT");
  return { version: 1, mint, indexedCreator, createdTimestamp,
    nextPaginationToken: null, pendingSignatures: [], inspectedSignatures: [],
    status: "INCOMPLETE", evidence: null, pagesFetched: 0 };
}
export function validateCreatorCheckpoint(value, expected = {}) {
  if (!value || value.version !== 1 || !address.test(value.mint || "") ||
      !address.test(value.indexedCreator || "") ||
      !Number.isSafeInteger(value.createdTimestamp) || value.createdTimestamp <= 0 ||
      !["INCOMPLETE","ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"].includes(value.status) ||
      !Array.isArray(value.pendingSignatures) || !Array.isArray(value.inspectedSignatures) ||
      value.pendingSignatures.length > 100 || value.inspectedSignatures.length > 1000 ||
      ![...value.pendingSignatures,...value.inspectedSignatures].every(s => signature.test(s)) ||
      !Number.isInteger(value.pagesFetched) || value.pagesFetched < 0 || value.pagesFetched > 100 ||
      (value.nextPaginationToken !== null &&
       (typeof value.nextPaginationToken !== "string" || value.nextPaginationToken.length > 2048)))
    throw Error("INVALID_CHECKPOINT");
  for (const field of ["mint","indexedCreator","createdTimestamp"])
    if (expected[field] !== undefined && value[field] !== expected[field]) throw Error("CHECKPOINT_IDENTITY_MISMATCH");
  return value;
}
export function advanceCreatorCheckpoint(checkpoint, { paginationToken, signatures = [], inspected = [], evidence = null } = {}) {
  validateCreatorCheckpoint(checkpoint);
  if (!Array.isArray(signatures) || !Array.isArray(inspected) ||
      ![...signatures,...inspected].every(s => signature.test(s))) throw Error("INVALID_SIGNATURES");
  const done = new Set([...checkpoint.inspectedSignatures,...inspected]);
  const pending = [...new Set([...checkpoint.pendingSignatures,...signatures])]
    .filter(s => !done.has(s));
  const next = { ...checkpoint, inspectedSignatures: [...done].slice(-1000),
    pendingSignatures: pending.slice(0,100),
    nextPaginationToken: paginationToken === undefined ? checkpoint.nextPaginationToken : paginationToken,
    pagesFetched: checkpoint.pagesFetched + (signatures.length ? 1 : 0),
    status: evidence ? "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW" : checkpoint.status,
    evidence: evidence || checkpoint.evidence };
  return validateCreatorCheckpoint(next, checkpoint);
}

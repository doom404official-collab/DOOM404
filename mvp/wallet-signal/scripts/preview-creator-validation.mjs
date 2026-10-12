import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { scanCreatorOrigin } from "../lib/creatorOriginPagedScan.mjs";

const mint = process.env.CREATOR_VALIDATION_MINT || "";
const permitted = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!permitted) console.log("CREATOR_VALIDATION: SKIPPED_NON_TARGET_ENV");
else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) console.log("CREATOR_VALIDATION: SKIPPED_NO_VALID_TEST_MINT");
else if (!process.env.HELIUS_RPC_URL) console.log("CREATOR_VALIDATION: HELIUS_RPC_URL_NOT_CONFIGURED");
else {
  try {
    const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL, pageLimit: 100 });
    const opts = { mint, lookupSignaturePage: rpc.lookupSignaturePage,
      fetchTransaction: rpc.fetchTransaction, maxPages: 2, maxTransactions: 15, maxDurationMs: 20000 };
    const first = await scanCreatorOrigin(opts);
    const second = first.resumeRequired && first.nextCursor
      ? await scanCreatorOrigin({ ...opts, before: first.nextCursor }) : null;
    const a = new Set(first.sampledSignatures);
    const overlap = second ? second.sampledSignatures.filter(s => a.has(s)) : [];
    console.log("CREATOR_VALIDATION:", JSON.stringify({
      mint, status: first.verified.length || second?.verified.length ? "CANDIDATE_VERIFIED_NEEDS_INDEPENDENT_REVIEW" : "UNRESOLVED",
      first: { sampled: first.sampled, retrieved: first.retrieved, nextCursor: first.nextCursor, failureReasons: first.failureReasons, verified: first.verified },
      second: second ? { sampled: second.sampled, retrieved: second.retrieved, nextCursor: second.nextCursor, failureReasons: second.failureReasons, verified: second.verified } : null,
      overlapCount: overlap.length, overlapSignatures: overlap,
      resumeRequired: second?.resumeRequired ?? first.resumeRequired,
      historyComplete: false,
    }));
  } catch {
    console.log("CREATOR_VALIDATION: RPC_DISCOVERY_OR_SCAN_FAILED");
  }
}

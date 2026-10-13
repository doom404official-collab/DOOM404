import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
import { createHeliusTimedHistory } from "../lib/heliusTimedHistory.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

const allowed = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
const mints = (process.env.CREATOR_MATRIX_MINTS || "").split(",").map(x => x.trim()).filter(Boolean);
const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if (!allowed) console.log("CREATOR_TIMED_MATRIX: SKIPPED_NON_TARGET_ENV");
else if (mints.length !== 5 || new Set(mints).size !== 5 || !mints.every(x => valid.test(x)) ||
  !process.env.HELIUS_RPC_URL) console.log("CREATOR_TIMED_MATRIX: SKIPPED_NOT_CONFIGURED");
else {
  const provider = createPumpFunIndexedCreatorProvider();
  const timed = createHeliusTimedHistory({ rpcUrl: process.env.HELIUS_RPC_URL });
  const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL });
  const results = [];
  for (const mint of mints) {
    try {
      const [indexed] = await provider.lookup(mint);
      if (!indexed?.creator || !indexed?.createdTimestamp) {
        results.push({ mint, status: "UNRESOLVED", reason: "NO_INDEXED_CREATOR" }); continue;
      }
      let inspected = 0, errors = 0, matched = null, pagesFetched = 0, signaturesFound = 0;
      let token = null, hasMore = false;
      const candidates = [], failureReasons = {}, seenTokens = new Set(), seenSignatures = new Set();
      for (let page = 0; page < 3; page++) {
        const discovery = await timed.lookup({
          address: mint, createdTimestamp: indexed.createdTimestamp,
          windowSeconds: 7200, limit: 30, paginationToken: token,
        });
        pagesFetched++;
        signaturesFound += discovery.signatures.length;
        hasMore = Boolean(discovery.paginationToken);
        for (const signature of discovery.signatures) {
          if (seenSignatures.has(signature) || inspected >= 45) continue;
          seenSignatures.add(signature);
          inspected++;
          try {
            const tx = await rpc.fetchTransaction(signature);
            if (!tx || tx.meta?.err != null) continue;
            const proof = verifyLaunchpadCreation({ mint, signature, transaction: tx, decoders: pumpFunDecoders });
            const creator = proof.decodedRoles?.[0]?.address;
            if (proof.status === "VERIFIED" && creator === indexed.creator) {
              matched = { signature, creator, programId: proof.decodedRoles[0].programId,
                decoderVersion: proof.decodedRoles[0].decoderVersion };
              break;
            }
            if (proof.status === "VERIFIED" && creator !== indexed.creator)
              candidates.push({ signature, reason: "CREATOR_MISMATCH" });
          } catch (error) {
            errors++;
            const known = ["RPC_UNSUPPORTED_VERSION","RPC_RATE_LIMITED","RPC_AUTH_FAILED","RPC_RESPONSE_ERROR","RPC_HTTP_ERROR"];
            const reason = known.includes(error?.message) ? error.message : "FETCH_EXCEPTION";
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
          }
        }
        if (matched || !discovery.paginationToken || inspected >= 45 || seenTokens.has(discovery.paginationToken)) break;
        seenTokens.add(discovery.paginationToken);
        token = discovery.paginationToken;
      }
      results.push({
        mint, indexedCreator: indexed.creator,
        status: matched ? "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW" : "INDEXED_UNVERIFIED",
        creationSignature: matched?.signature || null, evidence: matched ? [matched] : [],
        signaturesFound, hasMore, pagesFetched,
        inspected, errors, failureReasons, candidateDiscrepancies: candidates,
      });
    } catch {
      results.push({ mint, status: "UNRESOLVED", reason: "PROVIDER_OR_TIMED_LOOKUP_ERROR" });
    }
  }
  console.log("CREATOR_TIMED_MATRIX:", JSON.stringify({
    total: results.length, onchainMatches: results.filter(r => r.status === "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW").length,
    results, independentlyReviewed: false,
  }));
}

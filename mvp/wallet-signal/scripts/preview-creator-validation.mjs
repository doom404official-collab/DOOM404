import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

const mint = process.env.CREATOR_VALIDATION_MINT || "";
const validMint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
const permitted = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!permitted) {
  console.log("CREATOR_VALIDATION: SKIPPED_NON_TARGET_ENV");
} else if (!validMint) {
  console.log("CREATOR_VALIDATION: SKIPPED_NO_VALID_TEST_MINT");
} else if (!process.env.HELIUS_RPC_URL) {
  console.log("CREATOR_VALIDATION: HELIUS_RPC_URL_NOT_CONFIGURED");
} else {
  try {
    const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL, pageLimit: 100 });
    const history = await rpc.lookupSignatures(mint, { maxPages: 2 });
    const signatures = history.signatures.slice(-10).reverse();
    const verified = [];
    let retrieved = 0, failed = 0;
    for (const signature of signatures) {
      try {
        const tx = await rpc.fetchTransaction(signature);
        if (!tx || tx.meta?.err != null) continue;
        retrieved++;
        const result = verifyLaunchpadCreation({ mint, signature, transaction: tx, decoders: pumpFunDecoders });
        if (result.status === "VERIFIED") verified.push({ signature, creator: result.decodedRoles[0].address });
      } catch { failed++; }
    }
    // No RPC URLs, keys, request headers, or raw provider errors in logs.
    console.log("CREATOR_VALIDATION:", JSON.stringify({
      status: verified.length ? "CANDIDATE_VERIFIED_NEEDS_INDEPENDENT_REVIEW" : "UNRESOLVED",
      mint, sampled: signatures.length, retrieved, failed,
      historyComplete: false, verified,
    }));
  } catch {
    console.log("CREATOR_VALIDATION: RPC_DISCOVERY_FAILED");
  }
}

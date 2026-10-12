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
    const result = await scanCreatorOrigin({
      mint, lookupSignaturePage: rpc.lookupSignaturePage,
      fetchTransaction: rpc.fetchTransaction, maxPages: 5, maxTransactions: 25, maxDurationMs: 20000,
    });
    console.log("CREATOR_VALIDATION:", JSON.stringify(result));
  } catch {
    console.log("CREATOR_VALIDATION: RPC_DISCOVERY_OR_SCAN_FAILED");
  }
}

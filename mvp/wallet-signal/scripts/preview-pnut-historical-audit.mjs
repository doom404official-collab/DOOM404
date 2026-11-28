import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { inspectLegacyThreeStringCreate } from "../lib/pumpLegacyThreeStringCreate.mjs";

const mint = "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump";
const signature = "2Av1bHTDCSc9hU5nNHfFmn2xUuJftEV4HcwSszU6v5Axrf46vaGWbLjmTYysHkcv9ajsUpzWjF61VZaQE1EUWWme";
const enabled = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e" &&
  process.env.CREATOR_PNUT_HISTORICAL_ONCE === "true";
if (!enabled) {
  console.log("PNUT_HISTORICAL_AUDIT: SKIPPED_NOT_OPTED_IN");
} else if (!process.env.HELIUS_RPC_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("PNUT_HISTORICAL_AUDIT: MISSING_CONFIGURATION");
} else {
  try {
    const vault = createIntelligenceVault({
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    });
    const checkpoint = await vault.getCheckpoint(mint);
    if (!checkpoint?.inspectedSignatures?.includes(signature)) throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
    const rpc = createSolanaRpcAdapter({
      rpcUrl: process.env.HELIUS_RPC_URL,
      maxRequests: 3, maxRetries: 1, minIntervalMs: 500
    });
    const transaction = await rpc.fetchTransaction(signature);
    const findings = inspectLegacyThreeStringCreate({
      mint, transaction, indexedCreator: checkpoint.indexedCreator
    });
    console.log("PNUT_HISTORICAL_AUDIT:", JSON.stringify({
      status: "DIAGNOSTIC_ONLY", signature, findings,
      creatorVerified: false, writeAttempted: false
    }));
  } catch (error) {
    const safe = ["SIGNATURE_NOT_IN_CHECKPOINT", "RPC_RATE_LIMITED", "RPC_REQUEST_BUDGET_EXHAUSTED"];
    console.log("PNUT_HISTORICAL_AUDIT:", JSON.stringify({
      status: "UNRESOLVED",
      reason: safe.includes(error?.message) ? error.message : "AUDIT_FAILED"
    }));
  }
}

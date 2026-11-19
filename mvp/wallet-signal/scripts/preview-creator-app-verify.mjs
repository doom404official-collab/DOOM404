import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

const mint = process.env.CREATOR_DIAGNOSTIC_MINT;
const signature = "aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
const enabled = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e" &&
  process.env.CREATOR_APP_VERIFY_ONCE === "true";

if (!enabled) {
  console.log("CREATOR_APP_VERIFY: SKIPPED_NOT_OPTED_IN");
} else if (!mint || !process.env.HELIUS_RPC_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("CREATOR_APP_VERIFY: MISSING_CONFIGURATION");
} else {
  try {
    const vault = createIntelligenceVault({url: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY});
    const checkpoint = await vault.getCheckpoint(mint);
    if (!checkpoint?.inspectedSignatures?.includes(signature) || !checkpoint.indexedCreator) throw Error("CHECKPOINT_MISSING");
    const rpc = createSolanaRpcAdapter({rpcUrl: process.env.HELIUS_RPC_URL, maxRequests: 3, maxRetries: 1, minIntervalMs: 500});
    const transaction = await rpc.fetchTransaction(signature);
    const proof = verifyLaunchpadCreation({mint, signature, transaction, decoders: pumpFunDecoders});
    const role = proof.decodedRoles?.find(r => r.role === "launchpad_creator");
    const match = proof.status === "VERIFIED" && role?.address === checkpoint.indexedCreator;
    console.log("CREATOR_APP_VERIFY:", JSON.stringify({
      status: match ? "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW" : "UNRESOLVED",
      signature, proofStatus: proof.status, creatorMatched: match,
      decoderVersion: role?.decoderVersion ?? null, independentlyReviewed: false, writeAttempted: false
    }));
  } catch (error) {
    console.log("CREATOR_APP_VERIFY:", JSON.stringify({status: "UNRESOLVED", reason: "VALIDATION_FAILED"}));
  }
}

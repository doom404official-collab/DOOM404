import { createSolscanCreatorProvider } from "../lib/solscanCreatorProvider.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { resolveIndexedCreator } from "../lib/indexedCreatorResolver.mjs";
const mint = process.env.CREATOR_VALIDATION_MINT || "";
const permitted = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!permitted) console.log("INDEXED_CREATOR_VALIDATION: SKIPPED_NON_TARGET_ENV");
else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) console.log("INDEXED_CREATOR_VALIDATION: SKIPPED_INVALID_MINT");
else if (!process.env.SOLSCAN_API_KEY || !process.env.HELIUS_RPC_URL)
  console.log("INDEXED_CREATOR_VALIDATION: PROVIDER_NOT_CONFIGURED");
else {
  try {
    const solscan = createSolscanCreatorProvider({ apiKey: process.env.SOLSCAN_API_KEY });
    const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL });
    const result = await resolveIndexedCreator({ mint, providers: [solscan], fetchTransaction: rpc.fetchTransaction });
    console.log("INDEXED_CREATOR_VALIDATION:", JSON.stringify(result));
  } catch {
    console.log("INDEXED_CREATOR_VALIDATION: PROVIDER_LOOKUP_FAILED");
  }
}

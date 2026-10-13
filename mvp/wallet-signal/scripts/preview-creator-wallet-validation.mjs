import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyIndexedCreatorViaWallet } from "../lib/creatorWalletOriginCheck.mjs";

const mint = process.env.CREATOR_VALIDATION_MINT || "";
const allowed = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!allowed) console.log("CREATOR_WALLET_VALIDATION: SKIPPED_NON_TARGET_ENV");
else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) console.log("CREATOR_WALLET_VALIDATION: SKIPPED_INVALID_MINT");
else if (!process.env.HELIUS_RPC_URL) console.log("CREATOR_WALLET_VALIDATION: HELIUS_RPC_URL_NOT_CONFIGURED");
else {
  try {
    const [candidate] = await createPumpFunIndexedCreatorProvider().lookup(mint);
    if (!candidate?.creator || !candidate.createdTimestamp) {
      console.log("CREATOR_WALLET_VALIDATION:", JSON.stringify({ mint, status: "UNRESOLVED", reason: "INDEXED_CREATOR_OR_TIMESTAMP_MISSING" }));
    } else {
      const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL, pageLimit: 1000 });
      const result = await verifyIndexedCreatorViaWallet({
        mint, creator: candidate.creator, createdTimestamp: candidate.createdTimestamp,
        lookupSignaturePage: rpc.lookupSignaturePage, fetchTransaction: rpc.fetchTransaction,
        maxPages: 8, maxTransactions: 40,
      });
      console.log("CREATOR_WALLET_VALIDATION:", JSON.stringify(result));
    }
  } catch {
    console.log("CREATOR_WALLET_VALIDATION:", JSON.stringify({ mint, status: "UNRESOLVED", reason: "INDEX_OR_RPC_ERROR" }));
  }
}

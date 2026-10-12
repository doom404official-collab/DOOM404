import { createSolanaRpcAdapter } from "./creatorOriginRpc.mjs";
import { resolvePumpFunCreator } from "./creatorOriginPipeline.mjs";

/**
 * Server-only entry point. Uses the existing Vercel Preview secret.
 * No key or URL is returned to clients. Read-only and opt-in.
 */
export async function resolvePumpFunCreatorFromEnvironment({
  mint, env = process.env, fetchImpl = fetch, maxCandidates = 100,
} = {}) {
  const rpcUrl = env.HELIUS_RPC_URL;
  if (!rpcUrl) return { mint, status: "UNRESOLVED", reason: "HELIUS_RPC_URL_NOT_CONFIGURED" };
  const adapter = createSolanaRpcAdapter({ rpcUrl, fetchImpl });
  return resolvePumpFunCreator({
    mint,
    maxCandidates,
    lookupSignatures: (address) => adapter.lookupSignatures(address, { maxPages: 3 }),
    fetchTransaction: adapter.fetchTransaction,
  });
}

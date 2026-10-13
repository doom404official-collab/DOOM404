import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";

/** Independent re-fetch of the known creation signature; no inferred wallet roles. */
const mint = process.env.CREATOR_VALIDATION_MINT || "";
const signature = "KMoj9pQq8XncaZPHQ5bTNZPDgQwfCBgdihVkxc5Y27fh7iGYwMbti2Mcscprhia1NBJauBbEvs5DE8ooWKWg6bs";
const allowed = process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e";
if (!allowed) console.log("CREATION_EVIDENCE_AUDIT: SKIPPED_NON_TARGET_ENV");
else if (!process.env.HELIUS_RPC_URL) console.log("CREATION_EVIDENCE_AUDIT: HELIUS_RPC_URL_NOT_CONFIGURED");
else {
  try {
    const [candidate] = await createPumpFunIndexedCreatorProvider().lookup(mint);
    const rpc = createSolanaRpcAdapter({ rpcUrl: process.env.HELIUS_RPC_URL });
    const tx = await rpc.fetchTransaction(signature);
    const keys = tx?.transaction?.message?.accountKeys || [];
    const normalized = keys.map(k => typeof k === "string" ? { address: k, signer: null } :
      { address: k?.pubkey || null, signer: k?.signer === true });
    const feePayer = normalized[0]?.address || null;
    const signers = normalized.filter(k => k.signer === true).map(k => k.address);
    const proof = verifyLaunchpadCreation({ mint, signature, transaction: tx, decoders: pumpFunDecoders });
    const decodedCreator = proof.status === "VERIFIED" ? proof.decodedRoles[0]?.address : null;
    console.log("CREATION_EVIDENCE_AUDIT:", JSON.stringify({
      mint, signature, indexedCreator: candidate?.creator || null,
      transactionFound: Boolean(tx), transactionSucceeded: tx?.meta?.err == null && Boolean(tx),
      decodedCreator, matched: Boolean(decodedCreator && decodedCreator === candidate?.creator),
      feePayer, signerCount: signers.length, creatorIsSigner: signers.includes(candidate?.creator),
      creatorIsFeePayer: feePayer === candidate?.creator,
      programId: proof.decodedRoles?.[0]?.programId || null,
      decoderVersion: proof.decodedRoles?.[0]?.decoderVersion || null,
      proofStatus: proof.status,
      // Separate decoding from an independent review of the official program IDL.
      independentlyReviewed: false,
    }));
  } catch {
    console.log("CREATION_EVIDENCE_AUDIT: UNRESOLVED_PROVIDER_OR_DECODER_ERROR");
  }
}

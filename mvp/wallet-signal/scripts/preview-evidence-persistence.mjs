import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";
import { prepareCreatorEvidenceWrite } from "../lib/prepareCreatorEvidenceWrite.mjs";

const targets = [
  ["6MnQ921sqsShymdoqPv2RfhL5g2Hk2hoqPvgpDGcpump","aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7"],
  ["HSUMi4rMgjrx7zRUabw3ogGu1pa5hmF2eVcXj9Apump","23pzLeynMNuiPznPbqz15mXj1LwK1drnU4tCxUwUCVbSV1FXpUiibNfUojqcTonSKF5B6pQbb3runtjNe1MoAyNV"]
];
const enabled = process.env.VERCEL_ENV === "preview" &&
 process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e" &&
 process.env.CREATOR_EVIDENCE_PERSIST_ONCE === "true";
if (!enabled) {
 console.log("CREATOR_EVIDENCE_PERSIST: SKIPPED_NOT_OPTED_IN");
} else if (!process.env.HELIUS_RPC_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
 console.log("CREATOR_EVIDENCE_PERSIST: MISSING_CONFIGURATION");
} else {
 const results=[];
 const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
 const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:5,maxRetries:1,minIntervalMs:500});
 for (const [mint,signature] of targets) {
  const result={mint,status:"UNRESOLVED",writeAttempted:false,readbackMatched:false};
  try {
   const cp=await vault.getCheckpoint(mint);
   if (!cp?.indexedCreator || !cp.inspectedSignatures?.includes(signature)) throw Error("CHECKPOINT_MISSING");
   const tx=await rpc.fetchTransaction(signature);
   const proof=verifyLaunchpadCreation({mint,signature,transaction:tx,decoders:pumpFunDecoders});
   const payload=prepareCreatorEvidenceWrite({mint,indexedCreator:cp.indexedCreator,creationSignature:signature,proof});
   if (!payload) throw Error("PROOF_NOT_MATCHED");
   const record=await vault.getAttribution(mint);
   if (!record) await vault.putIndexedAttribution({mint,indexedCreator:cp.indexedCreator,creationTimestamp:cp.createdTimestamp});
   result.writeAttempted=true;
   result.status=await vault.storeCreatorEvidence(payload);
   const saved=await vault.getCreatorEvidence(mint);
   result.readbackMatched=saved.some(x=>x.signature===signature&&x.decoded_creator===cp.indexedCreator&&x.decoder_version===payload.p_decoder_version);
  } catch (error) {
   const allowed=["CHECKPOINT_MISSING","PROOF_NOT_MATCHED","VAULT_EVIDENCE_WRITE_FAILED","VAULT_REQUEST_FAILED","VAULT_AUTH_FAILED","RPC_RATE_LIMITED"];
   result.reason=allowed.includes(error?.message)?error.message:"PERSISTENCE_FAILED";
  }
  results.push(result);
 }
 console.log("CREATOR_EVIDENCE_PERSIST:",JSON.stringify({results,independentlyReviewed:false}));
}

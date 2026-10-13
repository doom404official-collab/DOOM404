import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { inspectPumpCreationLayout } from "../lib/pumpCreationLayoutAudit.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";
const mint="2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump";
const signature="2Av1bHTDCSc9hU5nNHfFmn2xUuJftEV4HcwSszU6v5Axrf46vaGWbLjmTYysHkcv9ajsUpzWjF61VZaQE1EUWWme";
const enabled=process.env.VERCEL_ENV==="preview"&&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e"&&
 process.env.CREATOR_PNUT_LAYOUT_ONCE==="true";
if(!enabled)console.log("PNUT_LAYOUT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("PNUT_LAYOUT_AUDIT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(signature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const tx=await rpc.fetchTransaction(signature);
  const layouts=inspectPumpCreationLayout({mint,transaction:tx});
  const proof=verifyLaunchpadCreation({mint,signature,transaction:tx,decoders:pumpFunDecoders});
  console.log("PNUT_LAYOUT_AUDIT:",JSON.stringify({
   status:"DIAGNOSTIC_ONLY",signature,layouts,
   proofStatus:proof.status,proofReason:proof.reason,
   indexedCreator:cp.indexedCreator,creatorVerified:proof.status==="VERIFIED"
  }));
 }catch(e){
  const safe=["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED","SIGNATURE_NOT_IN_CHECKPOINT","VAULT_REQUEST_FAILED"];
  console.log("PNUT_LAYOUT_AUDIT:",JSON.stringify({
   status:"UNRESOLVED",reason:safe.includes(e?.message)?e.message:"AUDIT_FAILED"
  }));
 }
}

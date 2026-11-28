import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { inspectPumpCreationLayout } from "../lib/pumpCreationLayoutAudit.mjs";
import { validateCreatorCheckpoint } from "../lib/creatorInvestigationCheckpoint.mjs";

const allowed=process.env.VERCEL_ENV==="preview" &&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e" &&
 process.env.CREATOR_LAYOUT_AUDIT_ONCE==="true";
const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const targetSignature="aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
if(!allowed)console.log("CREATOR_LAYOUT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.HELIUS_RPC_URL)
 console.log("CREATOR_LAYOUT_AUDIT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=validateCreatorCheckpoint(await vault.getCheckpoint(mint),{mint});
  if(!cp.inspectedSignatures.includes(targetSignature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const transaction=await rpc.fetchTransaction(targetSignature);
  const layouts=inspectPumpCreationLayout({mint,transaction});
  console.log("CREATOR_LAYOUT_AUDIT:",JSON.stringify({
   status:"DIAGNOSTIC_ONLY",signature:targetSignature,layouts,
   creatorVerified:false,checkpointUnchanged:true
  }));
 }catch(e){
  const safe=["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED","RPC_AUTH_FAILED","RPC_UNSUPPORTED_VERSION","SIGNATURE_NOT_IN_CHECKPOINT","INVALID_CHECKPOINT"];
  console.log("CREATOR_LAYOUT_AUDIT:",JSON.stringify({status:"UNRESOLVED",reason:safe.includes(e?.message)?e.message:"AUDIT_FAILED"}));
 }
}

import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { auditMissingQuoteCurve } from "../lib/pumpMissingQuoteCurveAudit.mjs";
const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const signature="aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
const enabled=process.env.VERCEL_ENV==="preview"&&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e"&&
 process.env.CREATOR_QUOTE_CURVE_ONCE==="true";
if(!enabled)console.log("CREATOR_QUOTE_CURVE_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("CREATOR_QUOTE_CURVE_AUDIT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(signature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const transaction=await rpc.fetchTransaction(signature);
  const findings=auditMissingQuoteCurve({mint,transaction});
  console.log("CREATOR_QUOTE_CURVE_AUDIT:",JSON.stringify({
   status:"DIAGNOSTIC_ONLY",signature,findings,creatorVerified:false
  }));
 }catch(e){
  const known=["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED","SIGNATURE_NOT_IN_CHECKPOINT","VAULT_REQUEST_FAILED"];
  console.log("CREATOR_QUOTE_CURVE_AUDIT:",JSON.stringify({
   status:"UNRESOLVED",reason:known.includes(e?.message)?e.message:"AUDIT_FAILED"
  }));
 }
}

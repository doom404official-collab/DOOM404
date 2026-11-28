import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { auditCreateV2ExtraAccount } from "../lib/pumpCreateV2ExtraAccountAudit.mjs";
const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const signature="aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
const enabled=process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e"&&process.env.CREATOR_FINAL_LAYOUT_ONCE==="true";
if(!enabled)console.log("CREATOR_FINAL_LAYOUT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("CREATOR_FINAL_LAYOUT_AUDIT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(signature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  // APP checkpoint already contains its indexed creator; the attribution table
  // may contain only our separately seeded reference token.
  const indexedCreator=cp.indexedCreator;
  if(!indexedCreator)throw Error("INDEXED_CREATOR_MISSING");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const tx=await rpc.fetchTransaction(signature);
  const audits=auditCreateV2ExtraAccount({mint,transaction:tx,indexedCreator});
  console.log("CREATOR_FINAL_LAYOUT_AUDIT:",JSON.stringify({status:"DIAGNOSTIC_ONLY",signature,audits,creatorVerified:false}));
 }catch(e){console.log("CREATOR_FINAL_LAYOUT_AUDIT:",JSON.stringify({status:"UNRESOLVED",
  reason:["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED","RPC_RETRY_AFTER_TOO_LONG","RPC_AUTH_FAILED","RPC_HTTP_ERROR","RPC_UNSUPPORTED_VERSION","SIGNATURE_NOT_IN_CHECKPOINT","INDEXED_CREATOR_MISSING","VAULT_AUTH_FAILED","VAULT_REQUEST_FAILED"].includes(e?.message)?e.message:"AUDIT_FAILED"}));}
}

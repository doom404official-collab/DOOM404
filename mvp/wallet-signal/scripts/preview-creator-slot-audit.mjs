import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const signature="aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
const enabled=process.env.VERCEL_ENV==="preview" &&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e" &&
 process.env.CREATOR_SLOT_AUDIT_ONCE==="true";
if(!enabled)console.log("CREATOR_SLOT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("CREATOR_SLOT_AUDIT: MISSING_CONFIGURATION");
else {
 try {
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(signature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const tx=await rpc.fetchTransaction(signature);
  if(!tx||tx.meta?.err!=null||!Number.isInteger(tx.slot)||!Number.isInteger(tx.blockTime))
   throw Error("TRANSACTION_METADATA_UNAVAILABLE");
  console.log("CREATOR_SLOT_AUDIT:",JSON.stringify({
   status:"TRANSACTION_METADATA_FOUND",signature,slot:tx.slot,
   blockTime:tx.blockTime,utc:new Date(tx.blockTime*1000).toISOString(),
   transactionSucceeded:true,creatorVerified:false
  }));
 }catch(e){
  const safe=["SIGNATURE_NOT_IN_CHECKPOINT","RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED",
   "RPC_AUTH_FAILED","TRANSACTION_METADATA_UNAVAILABLE"];
  console.log("CREATOR_SLOT_AUDIT:",JSON.stringify({
   status:"UNRESOLVED",reason:safe.includes(e?.message)?e.message:"AUDIT_FAILED"
  }));
 }
}

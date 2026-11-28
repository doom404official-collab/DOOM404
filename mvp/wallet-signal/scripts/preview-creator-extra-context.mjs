import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { inspectExtraAccountContext } from "../lib/pumpExtraAccountContext.mjs";
const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const signature="aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
const extra="6z6GDdfb2AjR9ZhJmAUQ5cipJCVxQvLJhB2H8mCwTFBP";
const enabled=process.env.VERCEL_ENV==="preview"&&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e"&&
 process.env.CREATOR_EXTRA_CONTEXT_ONCE==="true";
if(!enabled)console.log("CREATOR_EXTRA_CONTEXT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("CREATOR_EXTRA_CONTEXT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(signature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const tx=await rpc.fetchTransaction(signature);
  const result=inspectExtraAccountContext({mint,transaction:tx,extra});
  console.log("CREATOR_EXTRA_CONTEXT:",JSON.stringify({status:"DIAGNOSTIC_ONLY",signature,result,creatorVerified:false}));
 }catch(e){
  const known=["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED","SIGNATURE_NOT_IN_CHECKPOINT","VAULT_REQUEST_FAILED"];
  console.log("CREATOR_EXTRA_CONTEXT:",JSON.stringify({status:"UNRESOLVED",reason:known.includes(e?.message)?e.message:"CONTEXT_FAILED"}));
 }
}

import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { auditLegacyCreatorArguments } from "../lib/pumpLegacyCreatorArgumentAudit.mjs";
const mint="2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump";
const signature="2Av1bHTDCSc9hU5nNHfFmn2xUuJftEV4HcwSszU6v5Axrf46vaGWbLjmTYysHkcv9ajsUpzWjF61VZaQE1EUWWme";
const enabled=process.env.VERCEL_ENV==="preview"&&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e"&&
 process.env.CREATOR_PNUT_ARGS_ONCE==="true";
if(!enabled)console.log("PNUT_ARGUMENT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("PNUT_ARGUMENT_AUDIT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(signature))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const transaction=await rpc.fetchTransaction(signature);
  const findings=auditLegacyCreatorArguments({mint,transaction,indexedCreator:cp.indexedCreator});
  console.log("PNUT_ARGUMENT_AUDIT:",JSON.stringify({status:"DIAGNOSTIC_ONLY",signature,findings,creatorVerified:false}));
 }catch(e){
  const safe=["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED","SIGNATURE_NOT_IN_CHECKPOINT","VAULT_REQUEST_FAILED"];
  console.log("PNUT_ARGUMENT_AUDIT:",JSON.stringify({status:"UNRESOLVED",reason:safe.includes(e?.message)?e.message:"AUDIT_FAILED"}));
 }
}

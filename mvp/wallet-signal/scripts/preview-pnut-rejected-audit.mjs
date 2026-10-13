import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { summarizeRejectedCreation } from "../lib/rejectedCreationSummary.mjs";
import { validateCreatorCheckpoint } from "../lib/creatorInvestigationCheckpoint.mjs";

const mint="2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump";
const allowed=process.env.VERCEL_ENV==="preview" &&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e" &&
 process.env.CREATOR_PNUT_REJECT_ONCE==="true";
if(!allowed) console.log("PNUT_REJECT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("PNUT_REJECT_AUDIT: MISSING_CONFIGURATION");
else {
 try {
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=validateCreatorCheckpoint(await vault.getCheckpoint(mint),{mint});
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:8,maxRetries:0,minIntervalMs:500});
  const findings=[];let fetched=0;
  for(const signature of cp.inspectedSignatures.slice(0,8)){
   const tx=await rpc.fetchTransaction(signature);
   fetched++;
   const finding=summarizeRejectedCreation({mint,signature,transaction:tx});
   if(finding)findings.push(finding);
  }
  console.log("PNUT_REJECT_AUDIT:",JSON.stringify({
   status:"DIAGNOSTIC_ONLY",fetched,findings,creatorVerified:false,checkpointUnchanged:true
  }));
 }catch(e){
  const safe=["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED","RPC_AUTH_FAILED","INVALID_CHECKPOINT","VAULT_AUTH_FAILED"];
  console.log("PNUT_REJECT_AUDIT:",JSON.stringify({
   status:"UNRESOLVED",reason:safe.includes(e?.message)?e.message:"AUDIT_FAILED"
  }));
 }
}

import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { summarizeRejectedCreation } from "../lib/rejectedCreationSummary.mjs";
import { validateCreatorCheckpoint } from "../lib/creatorInvestigationCheckpoint.mjs";

/** Opt-in, read-only review of up to eight previously inspected signatures.
 * No new history scans, database writes, or attribution changes.
 */
const allowed=process.env.VERCEL_ENV==="preview" &&
  process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e" &&
  process.env.CREATOR_REJECT_REVIEW_ONCE==="true";
const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if(!allowed) console.log("CREATOR_REJECT_REVIEW: SKIPPED_NOT_OPTED_IN");
else if(!valid.test(mint)||!process.env.SUPABASE_URL||
  !process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.HELIUS_RPC_URL)
  console.log("CREATOR_REJECT_REVIEW: MISSING_CONFIGURATION");
else {
  try {
    const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,
      serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
    const checkpoint=await vault.getCheckpoint(mint);
    if(!checkpoint) throw Error("CHECKPOINT_MISSING");
    validateCreatorCheckpoint(checkpoint,{mint});
    const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,
      maxRequests:10,maxRetries:1,minIntervalMs:500});
    const findings=[];
    let fetched=0;
    for(const signature of checkpoint.inspectedSignatures.slice(0,8)){
      const transaction=await rpc.fetchTransaction(signature);
      fetched++;
      const finding=summarizeRejectedCreation({mint,signature,transaction});
      if(finding) findings.push(finding);
    }
    console.log("CREATOR_REJECT_REVIEW:",JSON.stringify({
      status:"DIAGNOSTIC_ONLY",mint,fetched,findings,
      creatorVerified:false,checkpointUnchanged:true,
    }));
  } catch(e) {
    const known=new Set(["RPC_RATE_LIMITED","RPC_REQUEST_BUDGET_EXHAUSTED",
      "RPC_UNSUPPORTED_VERSION","VAULT_REQUEST_FAILED","VAULT_AUTH_FAILED","INVALID_CHECKPOINT"]);
    console.log("CREATOR_REJECT_REVIEW:",JSON.stringify({
      status:"UNRESOLVED",reason:known.has(e?.message)?e.message:"REVIEW_FAILED",
    }));
  }
}

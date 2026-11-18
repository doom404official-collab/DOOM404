import { createPumpFunIndexedCreatorProvider } from "../lib/pumpFunIndexedCreatorProvider.mjs";
import { createHeliusTimedHistory } from "../lib/heliusTimedHistory.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { newCreatorCheckpoint, validateCreatorCheckpoint, advanceCreatorCheckpoint } from "../lib/creatorInvestigationCheckpoint.mjs";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
import { pumpFunDecoders } from "../lib/pumpFunCreation.mjs";
import { classifyCreatorCandidate } from "../lib/creatorCandidateDiagnostics.mjs";

/** One explicit preview run, max 8 transaction fetches; durable checkpoint.
 * Never auto-run on builds, never silently convert indexed evidence into verified.
 */
const mint=process.env.CREATOR_DIAGNOSTIC_MINT;
const allowed=process.env.VERCEL_ENV==="preview" &&
  process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e" &&
  process.env.CREATOR_RESUME_ONCE==="true";
const valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if(!allowed) console.log("CREATOR_RESUME_DIAGNOSTIC: SKIPPED_NOT_OPTED_IN");
else if(!valid.test(mint||"") || !process.env.HELIUS_RPC_URL ||
  !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log("CREATOR_RESUME_DIAGNOSTIC: MISSING_CONFIGURATION");
else {
  const failures={},classes={};
  const reason=e=>["RPC_RATE_LIMITED","RPC_RETRY_AFTER_TOO_LONG","RPC_REQUEST_BUDGET_EXHAUSTED",
    "RPC_UNSUPPORTED_VERSION","RPC_AUTH_FAILED","RPC_HTTP_ERROR","RPC_RESPONSE_ERROR",
    "HELIUS_TIMED_RATE_LIMITED","HELIUS_TIMED_RPC_ERROR","VAULT_REQUEST_FAILED",
    "VAULT_AUTH_FAILED"].includes(e?.message)?e.message:"UNKNOWN_ERROR";
  try{
    const [record]=await createPumpFunIndexedCreatorProvider().lookup(mint);
    if(!record?.creator||!record?.createdTimestamp) throw Error("INDEXED_RECORD_MISSING");
    const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
    const identity={mint,indexedCreator:record.creator,createdTimestamp:record.createdTimestamp};
    let cp=await vault.getCheckpoint(mint);
    cp=cp?validateCreatorCheckpoint(cp,identity):newCreatorCheckpoint(identity);
    const timed=createHeliusTimedHistory({rpcUrl:process.env.HELIUS_RPC_URL});
    const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:12,maxRetries:1,minIntervalMs:500});
    let fetchedPage=false,matched=null,inspected=0,halted=false;
    if(!cp.pendingSignatures.length && cp.status==="INCOMPLETE"){
      const batch=await timed.lookup({address:mint,createdTimestamp:record.createdTimestamp,
        limit:30,windowSeconds:7200,paginationToken:cp.nextPaginationToken});
      if(batch.paginationToken===cp.nextPaginationToken && cp.nextPaginationToken!==null) throw Error("PAGINATION_STALLED");
      cp=advanceCreatorCheckpoint(cp,{signatures:batch.signatures,paginationToken:batch.paginationToken});
      fetchedPage=true;
      await vault.saveCheckpoint(cp);
    }
    for(const signature of cp.pendingSignatures.slice(0,8)){
      try{
        const tx=await rpc.fetchTransaction(signature);
        inspected++;
        if(tx?.meta?.err==null){
          const proof=verifyLaunchpadCreation({mint,signature,transaction:tx,decoders:pumpFunDecoders});
          if(proof.status==="VERIFIED"){
            const creator=proof.decodedRoles[0]?.address;
            if(creator===record.creator) matched={signature,creator,decoderVersion:proof.decodedRoles[0].decoderVersion};
            else classes.CREATOR_MISMATCH=(classes.CREATOR_MISMATCH||0)+1;
          } else {
            const category=classifyCreatorCandidate(tx,mint);
            classes[category]=(classes[category]||0)+1;
          }
        }else classes.TRANSACTION_UNAVAILABLE_OR_FAILED=(classes.TRANSACTION_UNAVAILABLE_OR_FAILED||0)+1;
        cp=advanceCreatorCheckpoint(cp,{inspected:[signature],evidence:matched});
        await vault.saveCheckpoint(cp);
        if(matched)break;
      }catch(e){
        const code=reason(e);failures[code]=(failures[code]||0)+1;
        if(/RATE_LIMITED|BUDGET_EXHAUSTED|RETRY_AFTER_TOO_LONG|AUTH_FAILED/.test(code)){halted=true;break;}
        // Leave failed signature pending for a future retry; never mark as inspected.
        halted=true;break;
      }
    }
    console.log("CREATOR_RESUME_DIAGNOSTIC:",JSON.stringify({mint,indexedCreator:record.creator,
      status:cp.status,matched:matched?{signature:matched.signature,decoderVersion:matched.decoderVersion}:null,
      inspected,fetchedPage,pending:cp.pendingSignatures.length,
      totalInspected:cp.inspectedSignatures.length,pagesFetched:cp.pagesFetched,
      canContinue:!matched,halted,classes,failures,checkpointSaved:true}));
  }catch(e){
    console.log("CREATOR_RESUME_DIAGNOSTIC:",JSON.stringify({status:"UNRESOLVED",reason:reason(e),checkpointSaved:false}));
  }
}

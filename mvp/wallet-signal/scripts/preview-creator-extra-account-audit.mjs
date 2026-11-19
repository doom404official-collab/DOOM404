import { createIntelligenceVault } from "../lib/intelligenceVault.mjs";
import { createSolanaRpcAdapter } from "../lib/creatorOriginRpc.mjs";
import { PUMP_PROGRAM_ID } from "../lib/pumpFunCreation.mjs";
import { inspectPumpCreationLayout } from "../lib/pumpCreationLayoutAudit.mjs";
const mint=process.env.CREATOR_DIAGNOSTIC_MINT||"";
const sig="aLBaPgDsc5x6FgpirNJnmgFEjfz2DveHQ3xaKYeypdZq26WiYt7wjoVfNqgWMfiKR6DYveZmGiYAnN6Y593SXZ7";
const allowed=process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e"&&process.env.CREATOR_EXTRA_ACCOUNT_ONCE==="true";
if(!allowed)console.log("CREATOR_EXTRA_ACCOUNT_AUDIT: SKIPPED_NOT_OPTED_IN");
else if(!process.env.HELIUS_RPC_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 console.log("CREATOR_EXTRA_ACCOUNT_AUDIT: MISSING_CONFIGURATION");
else{
 try{
  const vault=createIntelligenceVault({url:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
  const cp=await vault.getCheckpoint(mint);
  if(!cp?.inspectedSignatures?.includes(sig))throw Error("SIGNATURE_NOT_IN_CHECKPOINT");
  const rpc=createSolanaRpcAdapter({rpcUrl:process.env.HELIUS_RPC_URL,maxRequests:3,maxRetries:1,minIntervalMs:500});
  const tx=await rpc.fetchTransaction(sig);
  const keys=(tx.transaction?.message?.accountKeys||[]).map(k=>typeof k==="string"?k:k?.pubkey);
  const instructions=[...(tx.transaction?.message?.instructions||[]),...(tx.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
  const ix=instructions.find(i=>{
   const id=i?.programId||(Number.isInteger(i?.programIdIndex)?keys[i.programIdIndex]:null);
   return id===PUMP_PROGRAM_ID && i.accounts?.length===20;
  });
  const accounts=ix?.accounts?.map(x=>Number.isInteger(x)?keys[x]:typeof x==="string"?x:x?.pubkey)||[];
  const layouts=inspectPumpCreationLayout({mint,transaction:tx});
  console.log("CREATOR_EXTRA_ACCOUNT_AUDIT:",JSON.stringify({
   status:"DIAGNOSTIC_ONLY",signature:sig,
   accountCount:accounts.length,extraAccounts:accounts.slice(16),
   layouts,creatorVerified:false
  }));
 }catch(e){console.log("CREATOR_EXTRA_ACCOUNT_AUDIT:",JSON.stringify({
  status:"UNRESOLVED",reason:["RPC_RATE_LIMITED","SIGNATURE_NOT_IN_CHECKPOINT"].includes(e?.message)?e.message:"AUDIT_FAILED"
 }));}
}

import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {PublicKey} from "@solana/web3.js";
import {createReliableConnection} from "../../../lib/reliableConnection.js";
import {prepareHolderScanSnapshot} from "../../../lib/prepareHolderScanSnapshot.mjs";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
export const dynamic="force-dynamic";
function authorized(request){
 const secret=process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN;
 const supplied=request.headers.get("x-glitch-internal-token");
 if(!secret||!supplied)return false;
 const a=Buffer.from(secret),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function POST(request){
 // Internal-only until durable public rate limiting, quotas and worker orchestration exist.
 if(process.env.GLITCH_HOLDER_SCAN_START_ENABLED!=="true")return NextResponse.json({error:"Scan creation not enabled"},{status:503});
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 let mint;
 try{
  const body=await request.json();
  mint=new PublicKey(body?.mint||"").toBase58();
 }catch{return NextResponse.json({error:"Invalid token mint"},{status:400});}
 let stage="store_configuration";
 try{
  const store=createHolderJobStore();
  stage="existing_job_lookup";
  const existing=await store.getLatest(mint);
  if(existing&&["queued","running"].includes(existing.status))
   return NextResponse.json({mint,status:existing.status,scan:store.publicView(existing)},{headers:{"Cache-Control":"no-store"}});
  stage="rpc_connection";
  const connection=createReliableConnection({primary:process.env.HELIUS_RPC_URL||process.env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com"});
  stage="holder_snapshot";
  const snapshot=await prepareHolderScanSnapshot({mint,connection});
  stage="job_persistence";
  const job=await store.createOrReuse(snapshot);
  return NextResponse.json({mint,status:job.status,jobId:job.id},{status:202,headers:{"Cache-Control":"no-store"}});
 }catch(error){
  const message=String(error?.message||"");
  const code=/^HOLDER_STORE_HTTP_\d{3}$/.test(message)?message:
   message==="HOLDER_STORE_NOT_CONFIGURED"?"HOLDER_STORE_NOT_CONFIGURED":
   message==="HOLDER_JOB_NOT_FOUND_AFTER_CONFLICT"?"HOLDER_JOB_NOT_FOUND_AFTER_CONFLICT":
   ["INVALID_TOKEN_SUPPLY","TOP20_UNAVAILABLE","NO_HOLDER_ACCOUNTS","HOLDER_OWNER_UNRESOLVED",
    "SNAPSHOT_LARGEST_ACCOUNTS_RPC_FAILED","SNAPSHOT_SUPPLY_RPC_FAILED","SNAPSHOT_OWNER_LOOKUP_RPC_FAILED","INVALID_HOLDER_SET","UNRESOLVED_HOLDER_OWNER"].includes(message)?message:
   /Solana RPC unavailable after retry and fallback/.test(message)?"RPC_RETRIES_EXHAUSTED":
   /429|rate limit/i.test(message)?"RPC_RATE_LIMITED":"UNEXPECTED_ERROR";
  console.error("GLITCH_SCAN_START_FAILURE",{stage,code});
  return NextResponse.json({error:"Unable to initialize holder investigation",stage,code},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}

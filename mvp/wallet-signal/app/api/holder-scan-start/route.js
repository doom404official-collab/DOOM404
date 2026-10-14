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
 try{
  const store=createHolderJobStore();
  const existing=await store.getLatest(mint);
  if(existing&&["queued","running"].includes(existing.status))
   return NextResponse.json({mint,status:existing.status,scan:store.publicView(existing)},{headers:{"Cache-Control":"no-store"}});
  const connection=createReliableConnection({primary:process.env.HELIUS_RPC_URL||process.env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com"});
  const snapshot=await prepareHolderScanSnapshot({mint,connection});
  const job=await store.createOrReuse(snapshot);
  return NextResponse.json({mint,status:job.status,jobId:job.id},{status:202,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Unable to initialize holder investigation"},{status:503});}
}

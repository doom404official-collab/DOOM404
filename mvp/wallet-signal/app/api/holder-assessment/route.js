import {NextResponse} from "next/server";
import {PublicKey} from "@solana/web3.js";
import {timingSafeEqual} from "node:crypto";
function internalAuthorized(request){
 const secret=process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN;
 const supplied=request.headers.get("x-glitch-internal-token");
 if(!secret||!supplied)return false;
 const a=Buffer.from(secret),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {createHolderEvidenceStore} from "../../../lib/holderEvidenceStore.mjs";
import {assessVerifiedHolderConcentration} from "../../../lib/verifiedHolderConcentrationAssessment.mjs";
export const dynamic="force-dynamic";
export async function GET(request){
 let mint;
 try{mint=new PublicKey(new URL(request.url).searchParams.get("mint")||"").toBase58();}
 catch{return NextResponse.json({error:"Invalid token mint"},{status:400});}
 try{
  const requestedJob=new URL(request.url).searchParams.get("jobId");
  if(requestedJob&&!internalAuthorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  if(requestedJob&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedJob))return NextResponse.json({error:"Invalid job ID"},{status:400});
  const job=requestedJob?await createHolderJobStore().getById(requestedJob):await createHolderJobStore().getLatest(mint);
  if(requestedJob&&(!job||job.mint!==mint))return NextResponse.json({error:"Job not found for mint"},{status:404});
  if(!job?.checkpoint)return NextResponse.json({mint,status:"not_started"},{headers:{"Cache-Control":"no-store"}});
  const evidenceRows=await createHolderEvidenceStore().listForJob(job.id);
  const assessment=assessVerifiedHolderConcentration({checkpoint:job.checkpoint,evidenceRows});
  return NextResponse.json({mint,jobId:job.id,scanStatus:job.status,updatedAt:job.updated_at,assessment},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Holder assessment unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}

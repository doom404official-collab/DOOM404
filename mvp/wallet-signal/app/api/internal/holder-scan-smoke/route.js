import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";

export const dynamic="force-dynamic";
export const maxDuration=60;
const TEST_MINT="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump";

function authorized(request){
 const secret=process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN;
 const supplied=request.headers.get("x-glitch-internal-token");
 if(!secret||!supplied)return false;
 const a=Buffer.from(secret),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}

/** Authenticated, preview-only configuration smoke check; performs no writes. */
export async function POST(request){
 if(process.env.VERCEL_ENV!=="preview"||
    process.env.GLITCH_HOLDER_SCAN_START_ENABLED!=="true"||
    process.env.GLITCH_HOLDER_WORKER_ENABLED!=="true"){
  return NextResponse.json({error:"Preview test disabled"},{status:503});
 }
 if(!authorized(request)){
  return NextResponse.json({error:"Unauthorized"},{status:401});
 }
 return NextResponse.json({
  status:"ready",
  mint:TEST_MINT,
  startConfigured:Boolean(process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN),
  workerConfigured:Boolean(process.env.GLITCH_HOLDER_WORKER_TOKEN),
  nextStep:"Run an authenticated start and worker test from a trusted runner"
 },{headers:{"Cache-Control":"no-store"}});
}

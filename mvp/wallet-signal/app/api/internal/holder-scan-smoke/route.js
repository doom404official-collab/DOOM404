import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {POST as startScan} from "../holder-scan-start/route.js";
import {POST as runTick} from "../holder-scan-tick/route.js";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
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
function internalRequest(path,body,header,token){
 return new Request("https://internal.invalid"+path,{method:"POST",
  headers:{"Content-Type":"application/json",[header]:token},body:JSON.stringify(body)});
}
/** Manual-only, authenticated preview smoke test. No production or public access. */
export async function POST(request){
 if(process.env.VERCEL_ENV!=="preview"||process.env.GLITCH_HOLDER_SCAN_START_ENABLED!=="true"||
    process.env.GLITCH_HOLDER_WORKER_ENABLED!=="true")
  return NextResponse.json({error:"Preview test disabled"},{status:503});
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!process.env.GLITCH_HOLDER_WORKER_TOKEN)return NextResponse.json({error:"Worker configuration missing"},{status:503});
 try{
  const startedResponse=await startScan(internalRequest("/api/holder-scan-start",
   {mint:TEST_MINT},"x-glitch-internal-token",process.env.GLITCH_HOLDER_SCAN_INTERNAL_TOKEN));
  const started=await startedResponse.json();
  if(!startedResponse.ok)return NextResponse.json({stage:"start",status:startedResponse.status,error:started.error||"Scan start failed"},{status:502});
  const tickResponse=await runTick(internalRequest("/api/holder-scan-tick",{},
   "x-glitch-worker-token",process.env.GLITCH_HOLDER_WORKER_TOKEN));
  const tick=await tickResponse.json();
  if(!tickResponse.ok)return NextResponse.json({stage:"worker",status:tickResponse.status,error:tick.error||"Worker failed"},{status:502});
  const row=await createHolderJobStore().getLatest(TEST_MINT);
  return NextResponse.json({mint:TEST_MINT,jobPersisted:Boolean(row),
   scanStatus:row?.status||"not_started",workerStatus:tick.status,
   requests:tick.requestCount??0,
   transactionsChecked:row?.summary?.transactionsChecked??0,
   directPairs:row?.summary?.directEdges??0,
   version:row?.version??null},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Preview smoke test unavailable"},{status:503});}
}

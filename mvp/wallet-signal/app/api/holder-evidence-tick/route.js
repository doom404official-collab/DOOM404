import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {createHolderEvidenceStore} from "../../../lib/holderEvidenceStore.mjs";
import {processEvidenceBatch} from "../../../lib/holderEvidenceBatch.mjs";
export const dynamic="force-dynamic";
export const maxDuration=60;
function isAuthorized(request){
 const expected=process.env.GLITCH_HOLDER_WORKER_TOKEN;
 const actual=request.headers.get("x-glitch-worker-token");
 if(!expected||!actual)return false;
 const a=Buffer.from(expected),b=Buffer.from(actual);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function POST(request){
 if(process.env.GLITCH_EVIDENCE_WORKER_ENABLED!=="true")return NextResponse.json({error:"Disabled"},{status:503});
 if(!isAuthorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const mint=process.env.GLITCH_EVIDENCE_MINT;
  if(!mint)return NextResponse.json({error:"Mint not configured"},{status:503});
  const job=await createHolderJobStore().getLatest(mint);
  if(!job?.checkpoint)return NextResponse.json({status:"not_started"});
  const endpoint=process.env.HELIUS_RPC_URL;
  if(!endpoint||!endpoint.startsWith("https://"))throw Error("RPC_NOT_CONFIGURED");
  let count=0;
  const rpc=async(method,params)=>{
   if(++count>6)throw Error("REQUEST_BUDGET");
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:count,method,params}),signal:AbortSignal.timeout(7000)});
   if(!response.ok)throw Error("RPC_HTTP_"+response.status);
   const body=await response.json();
   if(body.error)throw Error("RPC_METHOD_ERROR");
   return body.result;
  };
  const result=await processEvidenceBatch({jobId:job.id,checkpoint:job.checkpoint,
   store:createHolderEvidenceStore(),rpc,limit:6});
  return NextResponse.json({...result,requestCount:count},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Validation temporarily unavailable"},{status:503});}
}

import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {processHolderScanJob} from "../../../lib/holderScanWorker.mjs";
export const dynamic="force-dynamic";
export const maxDuration=60;
function authorized(request){
 const secret=process.env.GLITCH_HOLDER_WORKER_TOKEN;
 const supplied=request.headers.get("x-glitch-worker-token");
 if(!secret||!supplied)return false;
 const a=Buffer.from(secret),b=Buffer.from(supplied);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function POST(request){
 if(process.env.GLITCH_HOLDER_WORKER_ENABLED!=="true")return NextResponse.json({error:"Worker not enabled"},{status:503});
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 let jobId;
 try{jobId=(await request.json())?.jobId;if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(jobId))throw Error("INVALID_JOB");}
 catch{return NextResponse.json({error:"Invalid job ID"},{status:400});}
 try{
  const endpoint=process.env.HELIUS_RPC_URL;
  if(!endpoint||!/^https:\/\//.test(endpoint))throw Error("RPC_NOT_CONFIGURED");
  const store=createHolderJobStore();
  let count=0,last=0;
  const rpc=async(method,params)=>{
   if(count++>=25)throw Error("WORKER_REQUEST_LIMIT");
   const pause=Math.max(0,450-(Date.now()-last));
   if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
   last=Date.now();
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:count,method,params}),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error("RPC_HTTP_"+response.status);
   const body=await response.json();
   if(body.error)throw Error("RPC_METHOD_ERROR_"+body.error.code);
   return body.result;
  };
  const result=await processHolderScanJob({store,jobId,rpc,maxRequests:25,leaseSeconds:90});
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Worker execution unavailable"},{status:503});}
}

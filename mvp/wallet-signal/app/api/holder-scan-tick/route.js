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
/** Preview-only bounded scheduler tick; never accepts a caller-supplied RPC URL or checkpoint. */
export async function POST(request){
 if(process.env.GLITCH_HOLDER_WORKER_ENABLED!=="true")return NextResponse.json({error:"Worker disabled"},{status:503});
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const store=createHolderJobStore();
  const candidate=await store.getNextRunnable();
  if(!candidate)return NextResponse.json({status:"idle"},{headers:{"Cache-Control":"no-store"}});
  const endpoint=process.env.HELIUS_RPC_URL;
  if(!endpoint||!/^https:\/\//.test(endpoint))throw Error("RPC_NOT_CONFIGURED");
  let requestCount=0,last=0;
  const rpc=async(method,params)=>{
   if(requestCount>=20)throw Error("WORKER_REQUEST_LIMIT");
   const pause=Math.max(0,400-(Date.now()-last));
   if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
   last=Date.now();requestCount++;
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:requestCount,method,params}),signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error("RPC_HTTP_"+response.status);
   const payload=await response.json();
   if(payload.error)throw Error("RPC_METHOD_ERROR_"+payload.error.code);
   return payload.result;
  };
  const result=await processHolderScanJob({store,jobId:candidate.id,rpc,maxRequests:20,leaseSeconds:90});
  return NextResponse.json({status:result.status,requestCount:result.requestCount??0},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Scheduler tick unavailable"},{status:503});}
}

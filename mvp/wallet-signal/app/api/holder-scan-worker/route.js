import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {runBoundedHolderWorker,createHolderWorkerBudget,holderExecutionFailure} from "../../../lib/holderWorkerExecution.mjs";
import {setTimeout as delay} from "node:timers/promises";
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
 const budget=createHolderWorkerBudget();
 if(process.env.GLITCH_HOLDER_WORKER_ENABLED!=="true")return NextResponse.json({error:"Worker not enabled"},{status:503});
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 let jobId;
 try{jobId=(await budget.run("INPUT",()=>request.json()))?.jobId;if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(jobId))throw Error("INVALID_JOB");}
 catch{return NextResponse.json({error:"Invalid job ID"},{status:400});}
 try{
  const endpoint=process.env.HELIUS_RPC_URL;
  if(!endpoint||!/^https:\/\//.test(endpoint))throw Error("RPC_NOT_CONFIGURED");
  const store=createHolderJobStore();
  let count=0,last=0;
  const rpc=async(method,params,{signal})=>{
   if(count++>=25)throw Error("WORKER_REQUEST_LIMIT");
   const pause=Math.max(0,450-(Date.now()-last));
   if(pause)await delay(pause,undefined,{signal});
   signal.throwIfAborted();
   last=Date.now();
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:count,method,params}),signal});
   if(!response.ok)throw Error("RPC_HTTP_"+response.status);
   const body=await response.json();
   if(body.error)throw Error("RPC_METHOD_ERROR_"+body.error.code);
   return body.result;
  };
  const result=await runBoundedHolderWorker({budget,store,jobId,rpc,maxRequests:25,leaseSeconds:90});
  return NextResponse.json(result,{status:result.reconciliationRequired?503:200,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json(holderExecutionFailure({stage:"SETUP"},{jobId}),{status:503});}
}

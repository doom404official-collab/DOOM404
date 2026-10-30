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
/** Authenticated bounded scheduler tick; never accepts a caller-supplied RPC URL or checkpoint. */
export async function POST(request){
 const budget=createHolderWorkerBudget();
 if(process.env.GLITCH_HOLDER_WORKER_ENABLED!=="true")return NextResponse.json({error:"Worker disabled"},{status:503});
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 try{
  const store=createHolderJobStore();
  const candidate=await budget.run("SELECTION",signal=>store.getNextRunnable({signal}));
  if(!candidate)return NextResponse.json({status:"idle"},{headers:{"Cache-Control":"no-store"}});
  const endpoint=process.env.HELIUS_RPC_URL;
  if(!endpoint||!/^https:\/\//.test(endpoint))throw Error("RPC_NOT_CONFIGURED");
  let requestCount=0,last=0;
  const rpc=async(method,params,{signal})=>{
   if(requestCount>=20)throw Error("WORKER_REQUEST_LIMIT");
   const pause=Math.max(0,150-(Date.now()-last));
   if(pause)await delay(pause,undefined,{signal});
   signal.throwIfAborted();
   last=Date.now();requestCount++;
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:requestCount,method,params}),signal});
   if(!response.ok)throw Error("RPC_HTTP_"+response.status);
   const payload=await response.json();
   if(payload.error)throw Error("RPC_METHOD_ERROR_"+payload.error.code);
   return payload.result;
  };
  const result=await runBoundedHolderWorker({budget,store,jobId:candidate.id,rpc,maxRequests:20,leaseSeconds:90});
  return NextResponse.json({...result,view:undefined},{status:result.reconciliationRequired?503:200,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json(holderExecutionFailure({stage:"SELECTION_OR_SETUP"}),{status:503});}
}

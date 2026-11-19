import {readHolderRecoveryWindow,recoveryWindowOpen} from '../../../lib/holderRecoveryWindow.mjs';
import {createHolderRecoveryBudget,assertHolderBudgetSignal} from '../../../lib/holderRecoveryBudget.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {runPinnedHolderRecovery} from "../../../lib/holderPinnedRecovery.mjs";
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
 if(process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!=="fix/glitch-recovery-preflight-20261027"||process.env.GLITCH_HOLDER_RECOVERY_ENABLED!=="true")return NextResponse.json({error:"Recovery disabled"},{status:503});
 let window;
 try{window=readHolderRecoveryWindow();}catch{return NextResponse.json({error:"Recovery disabled"},{status:503});}
 const budget=createHolderRecoveryBudget({notAfter:window.expiresAt});
 // Dedicated recovery opt-in is independent of ordinary worker activation.
 // Keep GLITCH_HOLDER_WORKER_ENABLED absent/false for recovery-only use.
 if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 let jobId,mint,expectedVersion;
 try{
  ({jobId,mint,expectedVersion}=await budget.run('INPUT',()=>request.json()));
  if(!['c670f393-31b0-470c-a01f-cb2b813a1219','d07c0256-b472-4089-a237-99ed5e5c8cc4'].includes(jobId)||mint!=="98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump"||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw Error("INVALID_JOB");
 }catch{if(!recoveryWindowOpen(window))return NextResponse.json({error:"Recovery disabled"},{status:503});return NextResponse.json({error:"Invalid recovery identity"},{status:400});}
 if(!recoveryWindowOpen(window))return NextResponse.json({error:"Recovery disabled"},{status:503});
 if(expectedVersion!==window.versions[jobId])return NextResponse.json({error:"Recovery version not authorized"},{status:409});
 try{
  const endpoint=process.env.HELIUS_RPC_URL;
  if(!endpoint||!/^https:\/\//.test(endpoint))throw Error("RPC_NOT_CONFIGURED");
  const store=createHolderJobStore();
  let count=0,last=0;
  const rpc=async(method,params,{signal})=>{
   signal.throwIfAborted();
   if(count++>=20)throw Error("WORKER_REQUEST_LIMIT");
   const pause=Math.max(0,450-(Date.now()-last));
   if(pause)await delay(pause,undefined,{signal});
   signal.throwIfAborted();
   last=Date.now();
   const payload=JSON.stringify({jsonrpc:"2.0",id:count,method,params});
   assertHolderBudgetSignal(signal);
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
    body:payload,signal});
   if(!response.ok)throw Error("RPC_HTTP_"+response.status);
   const body=await response.json();
   if(body.error)throw Error("RPC_METHOD_ERROR_"+body.error.code);
   return body.result;
  };
  const result=await runPinnedHolderRecovery({store,jobId,mint,expectedVersion,rpc,budget,maxRequests:20,leaseSeconds:90});
  return NextResponse.json(result,{status:result.reconciliationRequired===true?503:200,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Worker execution unavailable"},{status:503});}
}

import {createHolderWorkerBudget,boundedHolderStore,holderExecutionFailure} from "../../../lib/holderWorkerExecution.mjs";
import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {createHolderJobStore} from "../../../lib/holderJobStore.mjs";
import {createHolderEvidenceStore} from "../../../lib/holderEvidenceStore.mjs";
import {processEvidenceBatch} from "../../../lib/holderEvidenceBatch.mjs";
import {loadSelectedHolderEvidenceJob} from "../../../lib/selectedHolderEvidenceJob.mjs";
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
 const budget=createHolderWorkerBudget(),execution={stage:"CONFIGURATION"};let selectedJobId,count=0;
 if(process.env.GLITCH_EVIDENCE_WORKER_ENABLED!=="true")return NextResponse.json({error:"Disabled"},{status:503});
 if(!isAuthorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
 let stage="configuration";
 try{
  const evidenceStore=boundedHolderStore(createHolderEvidenceStore(),budget,{nextJob:{},health:{},seed:{write:true},claim:{write:true},finish:{write:true}},execution);
  stage="selection";
  const selected=await evidenceStore.nextJob();
  if(!selected){stage="health";const health=await evidenceStore.health();return NextResponse.json({status:"idle",processed:0,claimed:0,leaseLost:0,requestCount:0,health},{headers:{"Cache-Control":"no-store"}});}
  stage="checkpoint";
  selectedJobId=selected.id;
  const job=await budget.run("CHECKPOINT",signal=>loadSelectedHolderEvidenceJob({selected,jobStore:{getById:id=>createHolderJobStore().getById(id,{signal})}}));
  stage="rpc_configuration";
  const endpoint=process.env.HELIUS_RPC_URL;
  if(!endpoint||!endpoint.startsWith("https://"))throw Error("RPC_NOT_CONFIGURED");
  const rpc=(method,params)=>budget.run("PROVIDER",async signal=>{
   if(++count>6)throw Error("REQUEST_BUDGET");
   const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:count,method,params}),signal:AbortSignal.any([signal,AbortSignal.timeout(7000)])});
   if(!response.ok)throw Error("RPC_HTTP_"+response.status);
   const body=await response.json();
   if(body.error)throw Error("RPC_METHOD_ERROR");
   return body.result;
  },{provider:true,maxOperationMs:7000});
  stage="validation_batch";
  const result=await processEvidenceBatch({jobId:job.id,checkpoint:job.checkpoint,
   store:evidenceStore,rpc,limit:6});
  if(result.leaseLost>0)throw Error("EVIDENCE_LEASE_LOST");
  stage="health";
  const health=await evidenceStore.health();
  return NextResponse.json({status:result.interrupted?"partial":result.claimed===0?"no_claims":"processed",jobId:job.id,...result,requestCount:count,health},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  if(execution.uncertain)return NextResponse.json(holderExecutionFailure(execution,{jobId:selectedJobId,requestCount:count}),{status:503,headers:{"Cache-Control":"no-store"}});
  const message=String(error?.message||"");
  const code=/^EVIDENCE_(SEED_FAILED|SEED_INVALID_RESPONSE|ENQUEUE_FAILED|CLAIM_FAILED|CLAIM_INVALID_RESPONSE|FINISH_FAILED|FINISH_INVALID_RESPONSE|LEASE_LOST)$/.test(message)?message:
   /^EVIDENCE_(SELECTION_INVALID|HEALTH_INVALID|JOB_NOT_FOUND|JOB_IDENTITY_MISMATCH|JOB_NOT_ELIGIBLE|CHECKPOINT_INVALID)$/.test(message)?message:
   ["INVALID_HOLDER_JOB_ID","INVALID_HOLDER_JOB_RESPONSE"].includes(message)?message:
   /^INVALID_EVIDENCE_JOB$/.test(message)?"INVALID_EVIDENCE_JOB":
   /^EVIDENCE_(STORE|RPC)_HTTP_\d{3}$/.test(message)?message:
   /^HOLDER_STORE_HTTP_\d{3}$/.test(message)?message:
   message==="RPC_NOT_CONFIGURED"?"RPC_NOT_CONFIGURED":
   message==="INVALID_LIMIT"?"INVALID_LIMIT":
   message==="INVALID_EVIDENCE_RESULT"?"INVALID_EVIDENCE_RESULT":
   message==="REQUEST_BUDGET"?"REQUEST_BUDGET":/^RECOVERY_[A-Z_]+_TIMEOUT$/.test(message)?"EXECUTION_TIMEOUT":"UNEXPECTED_ERROR";
  console.error("GLITCH_EVIDENCE_FAILURE",{stage,code});
  return NextResponse.json({error:"Validation temporarily unavailable",stage,code,...(selectedJobId?{jobId:selectedJobId}:{}),requestCount:count,reconciliationRequired:true,retryAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}

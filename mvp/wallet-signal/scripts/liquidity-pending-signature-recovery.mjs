import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {validateHistoryCheckpoint,HISTORY_CLASSIFICATION,decodeHistoricalCandidate,classifyHistoricalTransaction,inspectHistoricalSignerEvidence,historicalRoleAssessment} from "../lib/liquidityHistoricalDecoder.mjs";
import {retrieveHistoricalTransaction} from "../lib/liquidityHistoricalTransactionCompat.mjs";
import {retryLiquidityRateLimit} from "../lib/liquidityHistoricalRateLimit.mjs";
const pool=process.env.GLITCH_LIQUIDITY_POOL;
const source=process.env.GLITCH_HISTORY_CHECKPOINT;
const rpc=process.env.HELIUS_RPC_URL;
const output=process.env.GLITCH_PENDING_EVIDENCE_OUTPUT||"liquidity-pending-recovery-evidence.json";
const budget=Number(process.env.GLITCH_PENDING_REQUEST_BUDGET||12);
if(!pool||!source||!rpc||!Number.isSafeInteger(budget)||budget<2||budget>30)throw Error("INVALID_PENDING_RECOVERY_CONFIG");
const checkpoint=JSON.parse(await readFile(source,"utf8"));
validateHistoryCheckpoint(checkpoint,pool);
const pending=[...new Set(checkpoint.pendingSignatures||[])];
if(pending.length===0)throw Error("NO_PENDING_SIGNATURES");
const sourceDigest=createHash("sha256").update(JSON.stringify(checkpoint)).digest("hex");
let requests=0;
async function call(url,method,params){
 if(requests>=budget)throw Error("PENDING_RECOVERY_BUDGET_EXHAUSTED");
 requests++;
 const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("RPC_HTTP_"+response.status);
 const body=await response.json();
 if(body.error)throw Error("RPC_"+body.error.code+": "+String(body.error.message||"").slice(0,200));
 return body.result;
}
const report={schemaVersion:1,kind:"LIQUIDITY_PENDING_SIGNATURE_RECOVERY",pool,sourceDigest,classification:HISTORY_CLASSIFICATION,originalCheckpointPreserved:true,authorizationVerified:false,finalScore:null,transactions:[],unresolved:[]};
for(const signature of pending){
 if(requests>=budget){report.unresolved.push({signature,reason:"REQUEST_BUDGET_EXHAUSTED"});continue;}
 try{
  const tx=await retryLiquidityRateLimit(()=>retrieveHistoricalTransaction(call,rpc,signature));
  if(!tx){report.unresolved.push({signature,reason:"RPC_RETURNED_NULL"});continue;}
  const instructions=[...(tx.transaction?.message?.instructions||[]),...(tx.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
  const candidates=instructions.map(i=>decodeHistoricalCandidate(i,signature,tx.slot,"helius")).filter(Boolean);
  report.transactions.push({signature,slot:tx.slot,execution:classifyHistoricalTransaction(tx),candidates:candidates.map(e=>({...e,signerEvidence:inspectHistoricalSignerEvidence(tx,e),roleAssessment:historicalRoleAssessment(e,tx,pool)}))});
 }catch(error){report.unresolved.push({signature,reason:String(error.message).slice(0,180)});}
}
report.requests=requests;
report.status=report.unresolved.length?"PARTIAL_PENDING":"PENDING_BATCH_RETRIEVED";
await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,requests,processed:report.transactions.length,unresolved:report.unresolved.length,candidates:report.transactions.reduce((n,t)=>n+t.candidates.length,0),classification:HISTORY_CLASSIFICATION}));
if(report.unresolved.length)process.exitCode=1;

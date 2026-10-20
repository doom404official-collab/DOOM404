import {verifyHistoricalReplaySource} from "../lib/liquidityHistoricalReplaySource.mjs";
import {readFile,writeFile} from "node:fs/promises";
import {decodeHistoricalCandidate,classifyHistoricalTransaction,PUMP_AMM_PROGRAM,HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
import {retrieveHistoricalTransaction} from "../lib/liquidityHistoricalTransactionCompat.mjs";
import {retryLiquidityRateLimit} from "../lib/liquidityHistoricalRateLimit.mjs";
const pool=process.env.GLITCH_LIQUIDITY_POOL;
const planFile=process.env.GLITCH_HISTORY_REPLAY_PLAN;
const sourceFile=process.env.GLITCH_HISTORY_CHECKPOINT;
const rpc=process.env.HELIUS_RPC_URL;
const output=process.env.GLITCH_HISTORY_REPLAY_EVIDENCE||"liquidity-history-replay-evidence.json";
const budget=Number(process.env.GLITCH_HISTORY_REPLAY_BUDGET||20);
if(!pool||!planFile||!sourceFile||!rpc||!Number.isSafeInteger(budget)||budget<1||budget>60)throw Error("INVALID_REPLAY_CONFIGURATION");
const plan=JSON.parse(await readFile(planFile,"utf8"));
if(plan.kind!=="HISTORICAL_DECODER_REPLAY_PLAN"||plan.pool!==pool||plan.originalClassification!==HISTORY_CLASSIFICATION||plan.requiresExplicitReplay!==true||!Array.isArray(plan.signaturesToReplay)||! /^[a-f0-9]{64}$/.test(plan.sourceDigest)||plan.authorizationVerified!==false||plan.finalScore!==null||plan.originalCheckpointPreserved!==true||plan.signaturesToReplay.length>5000||plan.signaturesToReplay.some(s=>typeof s!=="string"||s.length<64||s.length>90))throw Error("INVALID_REPLAY_PLAN");
verifyHistoricalReplaySource(plan,JSON.parse(await readFile(sourceFile,"utf8")),pool);
let requests=0;
async function call(url,method,params){
 if(requests>=budget)throw Error("REPLAY_REQUEST_BUDGET_EXHAUSTED");
 requests++;
 const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("RPC_HTTP_"+response.status);
 const body=await response.json();
 if(body.error)throw Error("RPC_"+body.error.code+": "+String(body.error.message||"").slice(0,200));
 return body.result;
}
const report={schemaVersion:1,kind:"HISTORICAL_DECODER_REPLAY_EVIDENCE",pool,sourceDigest:plan.sourceDigest,originalCheckpointPreserved:true,classification:HISTORY_CLASSIFICATION,authorizationVerified:false,finalScore:null,transactions:[],unresolved:[]};
for(const signature of [...new Set(plan.signaturesToReplay)]){
 if(requests>=budget)break;
 try{
  const tx=await retryLiquidityRateLimit(()=>retrieveHistoricalTransaction(call,rpc,signature));
  if(!tx){report.unresolved.push({signature,reason:"RPC_RETURNED_NULL"});break;}
  const instructions=[...(tx.transaction?.message?.instructions||[]),...(tx.meta?.innerInstructions||[]).flatMap(x=>x.instructions||[])];
  const candidates=instructions.map(i=>decodeHistoricalCandidate(i,signature,tx.slot,"helius")).filter(Boolean);
  report.transactions.push({signature,slot:tx.slot,execution:classifyHistoricalTransaction(tx),programId:PUMP_AMM_PROGRAM,candidates});
 }catch(error){report.unresolved.push({signature,reason:String(error.message).slice(0,160)});break;}
}
report.requests=requests;report.remaining=plan.signaturesToReplay.length-report.transactions.length;report.status=report.unresolved.length?"PARTIAL_UNRESOLVED":report.remaining?"REQUEST_BUDGET_REACHED":"REPLAY_BATCH_COMPLETE";
await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,requests,processed:report.transactions.length,unresolved:report.unresolved.length,candidates:report.transactions.reduce((n,t)=>n+t.candidates.length,0),classification:HISTORY_CLASSIFICATION}));
if(report.unresolved.length)process.exitCode=1;

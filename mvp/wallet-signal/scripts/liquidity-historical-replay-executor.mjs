import {resolve} from "node:path";
import {createLiquidityHistoryDeadline,createLiquidityHistoryPublisher} from "../lib/liquidityHistoryRuntime.mjs";
import {verifyHistoricalReplaySource} from "../lib/liquidityHistoricalReplaySource.mjs";
import {readFile,realpath} from "node:fs/promises";
import {extractHistoricalTransactionCandidates,classifyHistoricalTransaction,PUMP_AMM_PROGRAM,HISTORY_CLASSIFICATION} from "../lib/liquidityHistoricalDecoder.mjs";
import {retrieveHistoricalTransaction} from "../lib/liquidityHistoricalTransactionCompat.mjs";
import {retryLiquidityRateLimit} from "../lib/liquidityHistoricalRateLimit.mjs";
const pool=process.env.GLITCH_LIQUIDITY_POOL;
const planFile=process.env.GLITCH_HISTORY_REPLAY_PLAN;
const sourceFile=process.env.GLITCH_HISTORY_CHECKPOINT;
const rpc=process.env.HELIUS_RPC_URL;
const output=process.env.GLITCH_HISTORY_REPLAY_EVIDENCE||"liquidity-history-replay-evidence.json";
const budget=Number(process.env.GLITCH_HISTORY_REPLAY_BUDGET||20);
if(!pool||!planFile||!sourceFile||!rpc||!Number.isSafeInteger(budget)||budget<1||budget>60)throw Error("INVALID_REPLAY_CONFIGURATION");
let endpoint;try{endpoint=new URL(rpc);}catch{throw Error('INVALID_REPLAY_ENDPOINT');}
if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash)throw Error('INVALID_REPLAY_ENDPOINT');
for(const input of [sourceFile,planFile]){
 const path=await realpath(input);if(path===resolve(output))throw Error('REPLAY_SOURCE_OUTPUT_COLLISION');
 try{if(await realpath(output)===path)throw Error('REPLAY_SOURCE_OUTPUT_COLLISION');}catch(error){if(error.code!=='ENOENT')throw error;}
}
const cancellation=new AbortController(),interrupt=()=>cancellation.abort();
process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
const runtime=createLiquidityHistoryDeadline({durationMs:Number(process.env.GLITCH_REPLAY_DURATION_MS||480000),signal:cancellation.signal});
const plan=JSON.parse(await readFile(planFile,"utf8"));
if(plan.kind!=="HISTORICAL_DECODER_REPLAY_PLAN"||plan.pool!==pool||plan.originalClassification!==HISTORY_CLASSIFICATION||plan.requiresExplicitReplay!==true||!Array.isArray(plan.signaturesToReplay)||! /^[a-f0-9]{64}$/.test(plan.sourceDigest)||plan.authorizationVerified!==false||plan.finalScore!==null||plan.originalCheckpointPreserved!==true||plan.signaturesToReplay.length>5000||plan.signaturesToReplay.some(s=>typeof s!=="string"||s.length<64||s.length>90))throw Error("INVALID_REPLAY_PLAN");
if(new Set(plan.signaturesToReplay).size!==plan.signaturesToReplay.length)throw Error("DUPLICATE_REPLAY_SIGNATURES");
verifyHistoricalReplaySource(plan,JSON.parse(await readFile(sourceFile,"utf8")),pool);
let requests=0;
async function call(url,method,params){
 if(requests>=budget)throw Error("REPLAY_REQUEST_BUDGET_EXHAUSTED");
 runtime.check();return runtime.run(async(signal,check)=>{
  check();requests++;
  const response=await fetch(url,{redirect:'error',method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal}).catch(()=>{throw Error('REPLAY_RPC_TRANSPORT_FAILED');});
  check();if(!response.ok)throw Error('RPC_HTTP_'+response.status);
  const body=await response.json();check();if(!body||typeof body!=='object'||(!Object.hasOwn(body,'result')&&!body.error))throw Error('INVALID_REPLAY_RESPONSE');
  if(body.error)throw Error('RPC_'+body.error.code);return body.result;
 });
}
const report={schemaVersion:1,kind:"HISTORICAL_DECODER_REPLAY_EVIDENCE",pool,sourceDigest:plan.sourceDigest,originalCheckpointPreserved:true,classification:HISTORY_CLASSIFICATION,authorizationVerified:false,finalScore:null,transactions:[],unresolved:[]};
const publisher=await createLiquidityHistoryPublisher(output);let publicationFailed=false;
async function preserve(final=false){
 const value={...report,requests,remaining:plan.signaturesToReplay.length-report.transactions.length,status:final?(report.unresolved.length?'PARTIAL_UNRESOLVED':report.transactions.length<plan.signaturesToReplay.length?'REQUEST_BUDGET_REACHED':'REPLAY_BATCH_COMPLETE'):'PARTIAL_UNRESOLVED'};
 try{await publisher.save(value);}catch(error){publicationFailed=true;throw error;}return value;
}
const retry=operation=>retryLiquidityRateLimit(operation,{sleep:ms=>runtime.run(signal=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('HISTORY_INTERRUPTED_OR_DEADLINE'));},{once:true});}))});
try{
await preserve();
for(const signature of plan.signaturesToReplay){
 if(requests>=budget)break;
 try{
  const tx=await retry(()=>retrieveHistoricalTransaction(call,rpc,signature));
  if(!tx){report.unresolved.push({signature,reason:"RPC_RETURNED_NULL"});break;}
  const candidates=extractHistoricalTransactionCandidates(tx,signature,tx.slot,"helius",pool);
  report.transactions.push({signature,slot:tx.slot,execution:classifyHistoricalTransaction(tx),programId:PUMP_AMM_PROGRAM,candidates});
 }catch(error){report.unresolved.push({signature,reason:String(error.message).slice(0,160)});break;}
 await preserve();
}
if(cancellation.signal.aborted&&!report.unresolved.length)report.unresolved.push({reason:'HISTORY_INTERRUPTED_OR_DEADLINE'});
const final=await preserve(true);
console.log(JSON.stringify({status:final.status,requests,processed:report.transactions.length,unresolved:report.unresolved.length,candidates:report.transactions.reduce((n,t)=>n+t.candidates.length,0),classification:HISTORY_CLASSIFICATION}));
if(report.unresolved.length)process.exitCode=1;
}catch(error){if(!publicationFailed){report.unresolved.push({reason:'HISTORY_INTERRUPTED_OR_DEADLINE'});await preserve();}throw error;}
finally{await publisher.close();process.off('SIGINT',interrupt);process.off('SIGTERM',interrupt);}

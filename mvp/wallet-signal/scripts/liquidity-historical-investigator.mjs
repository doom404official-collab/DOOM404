import {resolve} from "node:path";
import {createLiquidityHistoryDeadline,createLiquidityHistoryPublisher} from "../lib/liquidityHistoryRuntime.mjs";
import {validateHistoryCheckpoint,extractHistoricalTransactionCandidates} from "../lib/liquidityHistoricalDecoder.mjs";
import {retryLiquidityRateLimit} from "../lib/liquidityHistoricalRateLimit.mjs";
import {retrieveHistoricalTransaction} from "../lib/liquidityHistoricalTransactionCompat.mjs";
import {readFile,realpath} from "node:fs/promises";
const pool=process.env.GLITCH_LIQUIDITY_POOL;
const rpc=process.env.HELIUS_RPC_URL;
const fallback=process.env.ALCHEMY_RPC_URL;
const budgetInput=Number(process.env.GLITCH_HISTORY_BUDGET||60);
const pageInput=Number(process.env.GLITCH_HISTORY_PAGE_SIZE||25);
if(!Number.isSafeInteger(budgetInput)||budgetInput<2||!Number.isSafeInteger(pageInput)||pageInput<1)throw Error("INVALID_HISTORY_BOUNDS");
const limit=Math.min(200,budgetInput);
const pageSize=Math.min(100,pageInput,limit-1);
const output=process.env.GLITCH_HISTORY_OUTPUT||"liquidity-history-evidence.json";
if(!pool||!rpc||!/^https:\/\//.test(rpc)||!Number.isInteger(limit)||!Number.isInteger(pageSize))throw Error("INVALID_HISTORY_CONFIGURATION");
for(const endpoint of [rpc,fallback].filter(Boolean)){let target;try{target=new URL(endpoint);}catch{throw Error('INVALID_HISTORY_ENDPOINT');}if(target.protocol!=='https:'||target.username||target.password||target.hash)throw Error('INVALID_HISTORY_ENDPOINT');}
const {PublicKey}=await import("@solana/web3.js");
if(new PublicKey(pool).toBase58()!==pool)throw Error("INVALID_POOL");
if(!process.env.GLITCH_HISTORY_CHECKPOINT)throw Error('HISTORY_CONTINUATION_SOURCE_REQUIRED');
const sourcePath=await realpath(process.env.GLITCH_HISTORY_CHECKPOINT);
if(sourcePath===resolve(output))throw Error('HISTORY_SOURCE_OUTPUT_COLLISION');
try{if(await realpath(output)===sourcePath)throw Error('HISTORY_SOURCE_OUTPUT_COLLISION');}catch(error){if(error.code!=='ENOENT')throw error;}
const cancellation=new AbortController();
const interrupt=()=>cancellation.abort();process.on('SIGTERM',interrupt);process.on('SIGINT',interrupt);
const runtime=createLiquidityHistoryDeadline({durationMs:Number(process.env.GLITCH_HISTORY_DURATION_MS||480000),signal:cancellation.signal});
const state=JSON.parse(await readFile(sourcePath,'utf8'));
validateHistoryCheckpoint(state,pool);
for(const key of ['pages','requestCount'])if(!Number.isSafeInteger(state[key])||state[key]<0)throw Error('INVALID_HISTORY_COUNTER');
if(state.finalScore!==null||state.authorizationVerified!==false||state.withdrawalVerified!==false||!Array.isArray(state.errors||[]))throw Error('INVALID_HISTORY_CONTINUATION_STATE');
if(!Number.isSafeInteger(state.requestCount+limit)||typeof state.complete!=='boolean'||!state.seen.length||(!state.complete&&(typeof state.before!=='string'||!state.before)))throw Error('INVALID_HISTORY_CONTINUATION_SOURCE');
if(state.historyCoverageVerified!==state.complete||state.seen.some(sig=>typeof sig!=='string'||!sig)||(state.pendingSignatures||[]).some(sig=>typeof sig!=='string'||!sig)||new Set(state.pendingSignatures||[]).size!==(state.pendingSignatures||[]).length)throw Error('INVALID_HISTORY_CONTINUATION_SOURCE');
const publisher=await createLiquidityHistoryPublisher(output);
const seen=new Set(state.seen);
const pending=new Set(state.pendingSignatures||[]);
const unresolvedReasons=new Map(Object.entries(state.unresolvedReasons||{}));
let requests=0,errors=[];
const attemptedThisRun=new Set();
const priorRequests=state.requestCount,priorErrors=state.errors||[];
function snapshot(final=false){return {...state,seen:[...seen],pendingSignatures:[...pending],unresolvedReasons:Object.fromEntries(unresolvedReasons),requestCount:priorRequests+requests,errors:[...priorErrors,...errors],updatedAt:new Date().toISOString(),finalScore:null,withdrawalVerified:false,authorizationVerified:false,complete:final?state.complete:false,historyCoverageVerified:final&&state.complete&&pending.size===0,pendingSignatureCount:pending.size,signaturesAttemptedThisRun:attemptedThisRun.size,stopReason:final?(state.complete?'HISTORY_EXHAUSTED':errors.length?'RETRIEVAL_INCOMPLETE':requests>=limit?'REQUEST_BUDGET_EXHAUSTED':'CHECKPOINTED'):'RETRIEVAL_INCOMPLETE'};}
const retry=operation=>retryLiquidityRateLimit(operation,{sleep:ms=>runtime.run(signal=>new Promise((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('HISTORY_INTERRUPTED_OR_DEADLINE'));},{once:true});}))});
let publicationFailed=false;
async function preserve(final=false){try{await publisher.save(snapshot(final));}catch(error){publicationFailed=true;throw error;}}

async function call(url,method,params){
 if(requests>=limit)throw Error("HISTORY_REQUEST_BUDGET_EXHAUSTED");
 runtime.check();
 return runtime.run(async(signal,check)=>{
  check();requests++;
  const response=await fetch(url,{redirect:'error',method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal}).catch(()=>{throw Error('HISTORY_RPC_TRANSPORT_FAILED');});
  check();if(!response.ok)throw Error('RPC_HTTP_'+response.status);
  const body=await response.json();check();if(!body||typeof body!=='object'||(!Object.hasOwn(body,'result')&&!body.error))throw Error('INVALID_RPC_RESPONSE');
  if(body.error)throw Error('RPC_'+body.error.code);return body.result;
 });
}
try{
await preserve();
for(let page=0;requests<limit&&!state.complete;page++){
 let batch;
 try{batch=await retry(()=>call(rpc,"getSignaturesForAddress",[pool,{limit:pageSize,...(state.before?{before:state.before}:{})}]));}
 catch(e){errors.push({stage:"signatures",message:String(e.message)});break;}
 if(!Array.isArray(batch)){errors.push({stage:"signatures",message:"INVALID_RESPONSE"});break;}
 // Validate the entire provider page before processing any entry. Never erase
 // duplicate/conflicting observations by feeding them through the seen Set.
 if(batch.some(item=>typeof item?.signature!=="string"||!item.signature||!Number.isSafeInteger(item.slot)||item.slot<0)){errors.push({stage:"signatures",message:"INVALID_SIGNATURE_PAGE"});break;}
 if(new Set(batch.map(item=>item.signature)).size!==batch.length){errors.push({stage:"signatures",message:"DUPLICATE_SIGNATURE_PAGE"});break;}
 // A terminal cursor already in retained history is a replay/regression, not
 // page advancement. Partial-page resume with a new trailing signature remains valid.
 if(batch.length&&(batch.at(-1).signature===state.before||seen.has(batch.at(-1).signature))){errors.push({stage:"signatures",message:"HISTORY_CURSOR_NOT_ADVANCING"});break;}
 if(batch.length===0){state.complete=pending.size===0;break;}
 for(const item of batch){
  if(requests>=limit)break;
  if(seen.has(item.signature))continue;
  if(attemptedThisRun.has(item.signature)){errors.push({stage:"retry_guard",signature:item.signature});break;}
  attemptedThisRun.add(item.signature);
  let tx=null,provider="helius";
  try{tx=await retry(()=>retrieveHistoricalTransaction(call,rpc,item.signature));}
  catch(e){errors.push({stage:"transaction",signature:item.signature,message:String(e.message)});}
  if(!tx&&fallback&&requests<limit&&!cancellation.signal.aborted){
   try{tx=await retrieveHistoricalTransaction(call,fallback,item.signature);provider="alchemy";}
   catch(e){errors.push({stage:"archive",signature:item.signature,message:String(e.message)});}
  }
  if(!tx){const reason=requests>=limit?"REQUEST_BUDGET_EXHAUSTED":"RPC_TRANSACTION_UNAVAILABLE";errors.push({stage:"unresolved",signature:item.signature,reason});pending.add(item.signature);unresolvedReasons.set(item.signature,reason);break;}
  if(tx.slot!==item.slot){errors.push({stage:"slot_mismatch",signature:item.signature,expectedSlot:item.slot,returnedSlot:tx.slot});pending.add(item.signature);unresolvedReasons.set(item.signature,"TRANSACTION_SLOT_MISMATCH");break;}
  let events;
  try{events=extractHistoricalTransactionCandidates(tx,item.signature,item.slot,provider,pool);}
  catch(error){const reason=String(error.message);errors.push({stage:'transaction_proof',signature:item.signature,reason});pending.add(item.signature);unresolvedReasons.set(item.signature,reason);break;}
  state.events.push(...events);
  seen.add(item.signature);pending.delete(item.signature);unresolvedReasons.delete(item.signature);
  if(batch.every(entry=>seen.has(entry.signature))&&state.before!==batch.at(-1).signature){state.before=batch.at(-1).signature;state.pages++;}
  await preserve();
 }
 // Do not advance cursor past unresolved signatures or unprocessed items.
 if(batch.some(x=>!seen.has(x.signature)))break;
 if(state.before!==batch.at(-1).signature){state.before=batch.at(-1).signature;state.pages++;}
 // A short page is not proof of full history exhaustion; require an empty follow-up page.
}
if(cancellation.signal.aborted&&!errors.some(e=>e.stage==='interruption'))errors.push({stage:'interruption',message:'HISTORY_INTERRUPTED_OR_DEADLINE'});
await preserve(true);
console.log(JSON.stringify({status:state.complete?'history_exhausted':errors.length?'partial':'checkpointed',requests,signaturesProcessed:seen.size,candidateEvents:state.events.length,errors:errors.length,classification:state.classification}));
if(errors.length)process.exitCode=1;
}catch(error){
 // A failed publication is never retried: output or pending file needs reconciliation.
 if(!publicationFailed){errors.push({stage:'interruption',message:'HISTORY_INTERRUPTED_OR_DEADLINE'});state.complete=false;await preserve();}
 throw error;
}finally{await publisher.close();process.off('SIGTERM',interrupt);process.off('SIGINT',interrupt);}

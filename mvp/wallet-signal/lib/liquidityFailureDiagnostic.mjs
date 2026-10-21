import {createHash} from 'node:crypto';
const publicId=(value,max)=>typeof value==='string' && value.length>=32 && value.length<=max && /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)?value:null;
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const stages=new Set(['signatures','transaction','archive','unresolved','slot_mismatch','retry_guard']);
const reasons=new Set(['REQUEST_BUDGET_EXHAUSTED','RPC_TRANSACTION_UNAVAILABLE','TRANSACTION_SLOT_MISMATCH']);
export function summarizeLiquidityFailure(raw){
 let state;
 try {state=JSON.parse(raw);} catch {throw Error('INVALID_DIAGNOSTIC_SOURCE');}
 if(!state||typeof state!=='object'||Array.isArray(state))throw Error('INVALID_DIAGNOSTIC_SOURCE');
 // Deliberately omit provider messages, raw events, environment and unknown fields.
 // This is an audit summary, not a resumable checkpoint or authorization evidence.
 return {
  kind:'LIQUIDITY_HISTORY_FAILURE_DIAGNOSTIC',diagnosticVersion:1,continuationEligible:false,
  sourceDigest:createHash('sha256').update(raw).digest('hex'),
  pool:publicId(state.pool,44),cursor:publicId(state.before,88),
  completedSignatures:Array.isArray(state.seen)?state.seen.map(s=>publicId(s,88)).filter(Boolean):[],
  pendingSignatures:Array.isArray(state.pendingSignatures)?state.pendingSignatures.map(s=>publicId(s,88)).filter(Boolean):[],
  requestCount:count(state.requestCount),candidateEventCount:Array.isArray(state.events)?state.events.length:null,
  errors:Array.isArray(state.errors)?state.errors.map(e=>({stage:stages.has(e?.stage)?e.stage:'unknown',signature:publicId(e?.signature,88),reason:reasons.has(e?.reason)?e.reason:null,expectedSlot:count(e?.expectedSlot),returnedSlot:count(e?.returnedSlot)})):[],
  authorizationVerified:false,finalScore:null
 };
}

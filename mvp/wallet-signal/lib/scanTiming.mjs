/** Sanitized timing metadata only. Never stores a URL, token or credential. */
export function parseServerTiming(value){
 if(typeof value!=='string'||value.length>8192)return [];
 return value.split(',').slice(0,64).flatMap(item=>{
  const match=item.trim().match(/^([A-Za-z][A-Za-z0-9_-]{0,63})(?:;dur=([0-9]+(?:\.[0-9]+)?))?(?:;desc="([A-Za-z0-9 _.-]{0,100})")?$/);
  if(!match)return [];const duration=match[2]===undefined?null:Number(match[2]);if(duration!==null&&(!Number.isFinite(duration)||duration<0))return [];
  return [{name:match[1],durationMs:duration,...(match[3]?{description:match[3]}:{})}];
 });
}
export function scanRequestTiming({path,startedAt,headersAt,finishedAt,response}={}){
 const route=typeof path==='string'?path.split('?')[0]:'';
 return {route:/^\/api\/[a-z0-9-]+$/.test(route)?route:'unknown',headersMs:Math.max(0,Math.round(headersAt-startedAt)),totalMs:Math.max(0,Math.round(finishedAt-startedAt)),status:response?.status??null,cache:response?.headers?.get?.('X-Glitch-Admission-Cache')==='HIT'?'durable_hit':'miss_or_unreported',server:parseServerTiming(response?.headers?.get?.('Server-Timing'))};
}
/** Admission failures describe scanner capacity, never token sellability. */
export function scannerFailureMessage({code,retryAfterSeconds,primaryAccepted=false,cancelled=false}={}){
 const evidence=primaryAccepted?'Available observations are retained; the assessment remains incomplete.':'No token assessment was completed.';
 if(code==='RATE_LIMIT'){const s=Number(retryAfterSeconds),wait=Number.isFinite(s)&&s>0&&s<=86400?' Try again in approximately '+Math.max(1,Math.ceil(s/60))+' minute(s).':' Try again after the request window resets.';return 'Scanner request limit reached.'+wait+' '+evidence;}
 if(['PROVIDER_BUDGET','REQUEST_BUDGET'].includes(code))return 'The bounded investigation reached its provider budget. '+evidence;
 if(['CONCURRENT_LIMIT','DUPLICATE'].includes(code))return 'Another investigation is running. Try again shortly. '+evidence;
 if(code==='RELEASE_NOT_AUTHORIZED')return 'This release is not authorized for scanning in this environment. '+evidence;
 return primaryAccepted?'Additional evidence unavailable or timed out. Current mint observation retained; unresolved attributes remain Unknown.':cancelled?'Token inspection timed out. Evidence remains incomplete; no automatic retry was made.':'Token inspection unavailable or mismatched. Evidence remains Unknown.';
}

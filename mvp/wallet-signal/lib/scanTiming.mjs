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

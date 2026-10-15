import {createHash} from 'node:crypto';
import {createSharedRpcLimiter} from '../lib/sharedRpcLimiter.mjs';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Missing quota test configuration');process.exitCode=2;}
else{
 const providerHash=createHash('sha256').update('glitch-rpc-contention-diagnostic-v1').digest('hex');
 const limiter=createSharedRpcLimiter({supabaseUrl:url,serviceRoleKey:key,providerHash,limitRps:4});
 const outcomes=await Promise.allSettled(Array.from({length:12},()=>limiter.reserve()));
 const granted=outcomes.filter(r=>r.status==='fulfilled'&&r.value===true).length;
 const denied=outcomes.filter(r=>r.status==='fulfilled'&&r.value===false).length;
 const errors=outcomes.filter(r=>r.status==='rejected').length;
 console.log(JSON.stringify({status:errors?'failed':'measured',attempted:12,granted,denied,errors,
  limitRps:4,scope:'isolated diagnostic provider hash; no Helius calls'}));
 if(errors)process.exitCode=1;
}

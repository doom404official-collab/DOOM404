import {createHash} from 'node:crypto';
import {createSharedRpcLimiter} from './sharedRpcLimiter.mjs';
// Opt-in for customer workers only. Historical workers remain unchanged.
// A denied reservation waits briefly; exhausted wait budget fails closed.
export function createCustomerRpcAdmission({endpoint,supabaseUrl,serviceRoleKey,limitRps=2,fetchImpl=fetch,
 sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),maxWaits=8}={}){
 if(!endpoint||!/^https:\/\//.test(endpoint)||!Number.isInteger(maxWaits)||maxWaits<0)
  throw new TypeError('Invalid customer RPC admission configuration');
 const providerHash=createHash('sha256').update(endpoint).digest('hex');
 const limiter=createSharedRpcLimiter({supabaseUrl,serviceRoleKey,providerHash,limitRps,fetchImpl});
 return async function reserve(){
  for(let attempt=0;attempt<=maxWaits;attempt++){
   if(await limiter.reserve())return true;
   if(attempt<maxWaits)await sleep(250+Math.min(attempt,5)*100);
  }
  throw new Error('RPC_SHARED_CAPACITY_EXHAUSTED');
 };
}

export function isLiquidityRateLimit(error){
 return /RPC_HTTP_429|RPC_-32005|rate limit|too many requests/i.test(String(error?.message||error||""));
}
export async function retryLiquidityRateLimit(operation,{sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms)),maxRetries=2,baseDelayMs=750}={}){
 if(!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>3)throw Error("INVALID_RETRY_LIMIT");
 for(let attempt=0;;attempt++){
  try{return await operation();}
  catch(error){
   if(!isLiquidityRateLimit(error)||attempt>=maxRetries)throw error;
   await sleep(Math.min(5000,baseDelayMs*2**attempt));
  }
 }
}

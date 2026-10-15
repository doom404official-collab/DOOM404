export function createSharedRpcLimiter({supabaseUrl,serviceRoleKey,providerHash,limitRps=8,fetchImpl=fetch}={}){
 if(!supabaseUrl||!serviceRoleKey||!/^[a-f0-9]{64}$/.test(providerHash??'')||!Number.isInteger(limitRps)||limitRps<1)
 throw new TypeError('Invalid shared RPC limiter configuration');
 return {async reserve(){
  const response=await fetchImpl(new URL('/rest/v1/rpc/glitch_reserve_rpc_capacity',supabaseUrl).toString(),{
   method:'POST',headers:{apikey:serviceRoleKey,Authorization:'Bearer '+serviceRoleKey,'Content-Type':'application/json'},
   body:JSON.stringify({p_provider_hash:providerHash,p_limit:limitRps}),cache:'no-store'
  });
  if(!response.ok)throw Error('RPC_CAPACITY_UNAVAILABLE');
  const value=await response.json();
  if(typeof value!=='boolean')throw Error('RPC_CAPACITY_INVALID_RESPONSE');
  return value;
 }};
}

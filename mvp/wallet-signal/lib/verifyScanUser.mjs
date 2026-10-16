// Validate a bearer access token with Supabase Auth, never trust client-provided user IDs.
export async function verifyScanUser({authorization,url,anonKey,fetchImpl=fetch}={}){
 const token=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization??'')?.[1];
 if(!token||!url||!anonKey)return null;
 const base=new URL(url);
 if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash)throw Error('INVALID_AUTH_ORIGIN');
 const response=await fetchImpl(base.origin+'/auth/v1/user',{
  headers:{apikey:anonKey,Authorization:'Bearer '+token},cache:'no-store',
  signal:AbortSignal.timeout(5000)
 });
 if(!response.ok)return null;
 const user=await response.json();
 return typeof user?.id==='string'&&/^[0-9a-f-]{36}$/i.test(user.id)?{id:user.id}:null;
}

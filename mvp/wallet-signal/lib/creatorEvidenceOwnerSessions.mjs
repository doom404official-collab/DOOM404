// Owner-only preparation helper. No app imports, environment access or token storage.
import {validateCreatorSealedBinding} from './creatorEvidenceSealedBinding.mjs';
import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
import {readCreatorEvidenceBody} from './creatorEvidenceBody.mjs';
const origin='https://acwmtobcbpkjfqiatyke.supabase.co';
const identities={upload:'4b4d628a-d0cc-438e-bf04-661d1a5ea546',readback:'3393dbd5-209f-4e3b-934d-57006fcdc4fa'};
const reject=()=>{throw Error('CREATOR_OWNER_AUTH_REJECTED');};
const text=v=>typeof v==='string'&&v.length>0&&v.length<=4096&&!/[\r\n\0]/.test(v);
function checkedToken(response,uid,end,time){
 const token=response?.access_token;
 if(typeof token!=='string'||token.length>16384||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))reject();
 const claims=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(token.split('.')[1],'base64url')));
 // Scope validation of a response from the pinned TLS Auth endpoint, not local
 // JWT signature verification. Auth/Storage remain the signature authorities.
 if(claims.iss!==origin+'/auth/v1'||claims.sub!==uid||claims.role!=='authenticated'||claims.aud!=='authenticated'||claims.is_anonymous!==false||claims.aal!=='aal1'||!Number.isSafeInteger(claims.iat)||claims.iat<0||claims.iat>time||(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>time))||!Number.isSafeInteger(claims.exp)||claims.exp<=time||claims.exp<end||claims.exp<=claims.iat||claims.exp-claims.iat>3600)reject();
 if(response.token_type!=='bearer'||!Number.isSafeInteger(response.expires_in)||response.expires_in<1||response.expires_in>3600||(response.expires_at!==undefined&&response.expires_at!==claims.exp)||response.user?.id!==uid||response.user?.role!=='authenticated'||response.user?.is_anonymous!==false||response.user?.factors?.some(f=>f.status==='verified'))reject();
 return token;
}
/** Explicit arming requires separate approval; each invocation makes <=2 POSTs.
 * onDispatch receives only the phase, allowing conservative session accounting.
 */
export async function obtainCreatorOwnerSessions(options={},dependencies={}){
 if(options.enabled!==true)return null;
 try{
  const {sealedBinding,publishableKey,signal}=options;
  const {promptSecret,fetchImpl=fetch,now=Date.now,onDispatch=()=>{}}=dependencies;
  if(typeof promptSecret!=='function'||typeof now!=='function'||typeof onDispatch!=='function'||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(publishableKey))reject();
  const time=()=>{assertCreatorSignal(signal);const ms=now();if(!Number.isSafeInteger(ms)||ms<0)reject();return Math.floor(ms/1000);};
  const b=validateCreatorSealedBinding(sealedBinding,{phase:'preparation',nowSeconds:time()});
  if(b.uploadUid!==identities.upload||b.readUid!==identities.readback)reject();
  const live=()=>{const t=time();if(t>=Math.min(b.upload.startsAt,b.readback.startsAt))reject();return t;};
  const sessions={};
  for(const phase of ['upload','readback']){
   live();let email=await promptSecret(phase+' identity email'),password;
   if(!text(email)||!/^\S+@\S+\.\S+$/.test(email))reject();
   live();password=await promptSecret(phase+' identity password');if(!text(password))reject();
   live();
   try{sessions[phase]=await createCreatorExecutionBudget({maxDurationMs:10000}).run('OWNER_AUTH',async inner=>{
    assertCreatorSignal(inner);live();onDispatch(phase);
    const response=await fetchImpl(origin+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',cache:'no-store',headers:{apikey:publishableKey,'content-type':'application/json'},body:JSON.stringify({email,password}),signal:inner});
    assertCreatorSignal(inner);live();
    if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??''))reject();
    const bytes=await readCreatorEvidenceBody(response,{maxBytes:65536,signal:inner});assertCreatorSignal(inner);live();
    const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    // Never retain/use refresh_token or return the original response.
    delete parsed.refresh_token;
    try{return checkedToken(parsed,identities[phase],b[phase].expiresAt,live());}
    finally{delete parsed.access_token;bytes.fill(0);}
   },{signal});}finally{email=undefined;password=undefined;}
  }
  live();return sessions;
 }catch{reject();} // Never expose provider messages, credentials or response bodies.
}

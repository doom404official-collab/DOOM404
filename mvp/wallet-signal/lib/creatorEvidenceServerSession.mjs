// Inactive preparation: trusted server composition only, never request configuration.
// Existing historical preflight and Storage operation claims remain mandatory upstream.
import {validateCreatorSealedBinding} from './creatorEvidenceSealedBinding.mjs';
import {verifyCreatorGithubOidc,screenCreatorGithubToken,createCreatorGithubJwksResolver} from './creatorEvidenceOidc.mjs';
import {validateCreatorAuthSession} from './creatorEvidenceOwnerSessions.mjs';
import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
import {readCreatorEvidenceBody} from './creatorEvidenceBody.mjs';
const origin='https://acwmtobcbpkjfqiatyke.supabase.co';
const identities={upload:['4b4d628a-d0cc-438e-bf04-661d1a5ea546','doom404official@gmail.com','CREATOR_MACHINE_UPLOAD_PASSWORD'],readback:['3393dbd5-209f-4e3b-934d-57006fcdc4fa','vijayananthrajkumar@gmail.com','CREATOR_MACHINE_READBACK_PASSWORD']};
const rejected=()=>Error('CREATOR_SERVER_SESSION_REJECTED');
/** Permanent SQL reservation is the restart/concurrency fence. No cache, refresh,
 * retry, release or completion mutation. A reservation means outcome UNKNOWN even
 * if no HTTP was dispatched; only independent reconciliation may establish more.
 */
export function createCreatorServerSession(options={},dependencies={}){
 if(options.enabled!==true)return async()=>null;
 return async({signal}={})=>{
  let reserved=false;
  try{
   if(typeof window!=='undefined')throw rejected();
   const {phase,githubToken,sealedBinding,deployment,publishableKey}=options;
   if(!Object.hasOwn(identities,phase)||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,256}$/.test(publishableKey))throw rejected();
   const {now=Date.now,fetchImpl=fetch,readSecret,attemptClient}=dependencies;
   const time=()=>{assertCreatorSignal(signal);const ms=now();if(!Number.isSafeInteger(ms)||ms<0)throw rejected();return Math.floor(ms/1000);};
   const b=validateCreatorSealedBinding(sealedBinding,{phase:'runtime',nowSeconds:time()});
   const d=structuredClone(deployment),expected={target:'preview',projectId:b.vercelProjectId,id:b.deploymentId,url:b.deploymentUrl,commit:b.commit,branch:'fix/glitch-recovery-preflight-20261027'};
   if(!d||Object.keys(d).length!==6||Object.keys(expected).some(k=>d[k]!==expected[k])||b.uploadUid!==identities.upload[0]||b.readUid!==identities.readback[0]||typeof readSecret!=='function'||typeof attemptClient?.query!=='function')throw rejected();
   const manifest=b[phase],live=()=>{const t=time();if(t<manifest.startsAt||t>=manifest.expiresAt)throw rejected();return t;};
   live();screenCreatorGithubToken(githubToken);
   const budget=createCreatorExecutionBudget({maxDurationMs:15000});
   const jwks=await budget.run('SESSION_JWKS',inner=>createCreatorGithubJwksResolver({enabled:true,fetchImpl})({signal:inner}),{signal});
   const authenticate=()=>verifyCreatorGithubOidc(githubToken,{manifest,jwks,nowSeconds:live()});
   authenticate();
   // No Auth credential access until exact cryptographic admission AND durable claim.
   reserved=true;
   const result=await budget.run('AUTH_RESERVATION',inner=>attemptClient.query({text:'SELECT creator_relay_test_private.relay_auth_attempt($1::jsonb) AS result',values:[JSON.stringify({phase,binding:b,deployment:d})],signal:inner}),{signal});
   authenticate();
   if(result?.rows?.length!==1||result.rows[0].result!==true)throw rejected();
   return await budget.run('SERVER_AUTH',async inner=>{
    assertCreatorSignal(inner);authenticate();
    let password=readSecret(identities[phase][2]);
    try{
     if(typeof password!=='string'||!password||password.length>4096||/[\r\n\0]/.test(password))throw rejected();
     assertCreatorSignal(inner);authenticate();
     const response=await fetchImpl(origin+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',cache:'no-store',headers:{apikey:publishableKey,'content-type':'application/json'},body:JSON.stringify({email:identities[phase][1],password}),signal:inner});
     assertCreatorSignal(inner);authenticate();
     if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??''))throw rejected();
     const bytes=await readCreatorEvidenceBody(response,{maxBytes:65536,signal:inner});
     try{
      assertCreatorSignal(inner);authenticate();
      const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      delete parsed.refresh_token;
      try{return validateCreatorAuthSession(parsed,identities[phase][0],manifest.expiresAt,live());}
      finally{delete parsed.access_token;}
     }finally{bytes.fill(0);}
    }finally{password=undefined;}
   },{signal});
  }catch{throw Error(reserved?'CREATOR_AUTH_ATTEMPT_RECONCILIATION_REQUIRED':'CREATOR_SERVER_SESSION_REJECTED');}
 };
}

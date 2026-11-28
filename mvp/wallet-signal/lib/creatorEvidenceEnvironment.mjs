// Internal Node-only implementation. Next.js consumers MUST use the .server.js
// entrypoint; no active route/workflow imports either module.
import {createCreatorSealedRuntime} from './creatorEvidenceSealedRuntime.mjs';
import {validateCreatorSealedBinding} from './creatorEvidenceSealedBinding.mjs';
import {TEST_REF} from './creatorEvidenceTestProfile.mjs';
const projectId='prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e';
const reject=()=>{throw Error('CREATOR_ENV_CONFIGURATION_REJECTED');};
const disabled=()=>async()=>Response.json({status:'DISABLED'},{status:404,headers:{'cache-control':'no-store'}});
/** Explicit server-owned options only. No env flag can enable this factory.
 * readVariable is a test seam, not a request-controlled source.
 * Returns only a handler; configuration/credentials never leave the closure.
 */
export function createCreatorEnvironmentRuntime(options={},dependencies={}){
 try{
  if(typeof window!=='undefined')reject();
  if(options.enabled!==true)return disabled();
  const hasPhase=Object.hasOwn(options,'phase');
  if(Object.keys(options).length!==(hasPhase?5:4)||!['enabled','sealedBinding','storageSessions','publishableKey'].every(k=>Object.hasOwn(options,k))||(hasPhase&&!['upload','readback'].includes(options.phase)))reject();
  const read=dependencies.readVariable??(name=>process.env[name]);
  const now=dependencies.now??Date.now;
  if(typeof read!=='function'||typeof now!=='function')reject();
  // Scope checks precede binding/credential reads. Never enumerate process.env.
  if(read('VERCEL_ENV')!=='preview'||read('VERCEL_TARGET_ENV')!=='preview'||read('VERCEL_GIT_COMMIT_REF')!==TEST_REF.slice(11)||read('VERCEL_PROJECT_ID')!==projectId)reject();
  const time=now();if(!Number.isSafeInteger(time)||time<0)reject();
  const b=validateCreatorSealedBinding(options.sealedBinding,{phase:'runtime',nowSeconds:Math.floor(time/1000)});
  const deployment={target:'preview',projectId,id:read('VERCEL_DEPLOYMENT_ID'),url:'https://'+read('VERCEL_URL'),commit:read('VERCEL_GIT_COMMIT_SHA'),branch:TEST_REF.slice(11)};
  if(deployment.id!==b.deploymentId||deployment.url!==b.deploymentUrl||deployment.commit!==b.commit)reject();
  // PEM contents only; no path reads, URL fetch, escape expansion or CA fallback.
  const ca=read('CREATOR_TEST_DB_CA_PEM');
  const postgresConfigs=Object.fromEntries(['issuer','consumer','verifier'].map(purpose=>{
   const password=read('CREATOR_TEST_DB_'+purpose.toUpperCase()+'_PASSWORD');
   if(typeof password!=='string'||!password||password.length>4096||/[\0\r\n]/.test(password))reject();
   return [purpose,{host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',user:'creator_test_'+purpose+'_login',password,ca}];
  }));
  return createCreatorSealedRuntime({enabled:true,...(hasPhase?{phase:options.phase}:{}),sealedBinding:b,deployment,postgresConfigs,storageSessions:options.storageSessions,publishableKey:options.publishableKey},{now,fetchImpl:dependencies.fetchImpl??fetch});
 }catch{reject();}
}

// Server-only endpoint bootstrap. Does not enable a handler or read secrets.
export function readCreatorPreviewIdentity(read){
 try{
  if(read('VERCEL_ENV')!=='preview'||read('VERCEL_TARGET_ENV')!=='preview'||read('VERCEL_GIT_COMMIT_REF')!==TEST_REF.slice(11)||read('VERCEL_PROJECT_ID')!==projectId)reject();
  const d={target:'preview',projectId,id:read('VERCEL_DEPLOYMENT_ID'),url:'https://'+read('VERCEL_URL'),commit:read('VERCEL_GIT_COMMIT_SHA'),branch:TEST_REF.slice(11)};
  if(!/^dpl_[A-Za-z0-9]{1,100}$/.test(d.id)||!/^https:\/\/doom404-wallet-signal-[a-z0-9]+-doom-404\.vercel\.app$/.test(d.url)||!/^[a-f0-9]{40}$/.test(d.commit))reject();return d;
 }catch{reject();}
}

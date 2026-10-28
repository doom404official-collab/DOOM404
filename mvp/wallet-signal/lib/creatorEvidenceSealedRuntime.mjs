// Preparation only: no environment reads, active route or workflow imports.
import {validateCreatorSealedBinding} from './creatorEvidenceSealedBinding.mjs';
import {createCreatorSyntheticRuntimeIntegration} from './creatorEvidenceSyntheticIntegration.mjs';
import {TEST_REF} from './creatorEvidenceTestProfile.mjs';
const reject=()=>{throw Error('CREATOR_SEALED_RUNTIME_REJECTED');};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))reject();};
const disabled=()=>Response.json({status:'DISABLED'},{status:404,headers:{'cache-control':'no-store'}});
const project='acwmtobcbpkjfqiatyke';
// This is a credential-scope screen, NOT JWT authentication. Hosted Auth/Storage
// must verify the signature. No caller token is ever used as a Storage credential.
function session(value,uid,end){
 if(typeof value!=='string'||value.length>16384||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(value))reject();
 let p;try{p=JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString('utf8'));}catch{reject();}
 if(p?.sub!==uid||p.role!=='authenticated'||p.aud!=='authenticated'||p.iss!==`https://${project}.supabase.co/auth/v1`||!Number.isSafeInteger(p.exp)||p.exp<end)reject();
 return value;
}
/** Server-owned config only; request headers/body never supply any option.
 * Disabled returns before touching binding, credentials or network dependencies.
 */
export function createCreatorSealedRuntime(configuration={}, {now=Date.now,fetchImpl=fetch}={}){
 if(configuration.enabled!==true)return async()=>disabled();
 try{
  exact(configuration,['enabled','sealedBinding','deployment','postgresConfigs','storageSessions','publishableKey']);
  if(typeof now!=='function'||typeof fetchImpl!=='function')reject();
  const time=()=>{const ms=now();if(!Number.isSafeInteger(ms)||ms<0)reject();return Math.floor(ms/1000);};
  const b=validateCreatorSealedBinding(configuration.sealedBinding,{phase:'runtime',nowSeconds:time()});
  const d=configuration.deployment;exact(d,['target','projectId','id','url','commit','branch']);
  if(d.target!=='preview'||d.projectId!==b.vercelProjectId||d.id!==b.deploymentId||d.url!==b.deploymentUrl||d.commit!==b.commit||d.branch!==TEST_REF.slice('refs/heads/'.length))reject();
  exact(configuration.postgresConfigs,['issuer','consumer','verifier']);
  const postgresConfigs=structuredClone(configuration.postgresConfigs);
  for(const purpose of ['issuer','consumer','verifier']){
   const c=postgresConfigs[purpose];exact(c,['host','port','database','user','password','ca']);
   if(c.host!==`db.${project}.supabase.co`||c.port!==5432||c.database!=='postgres'||c.user!==`creator_test_${purpose}_login`)reject();
  }
  exact(configuration.storageSessions,['upload','readback']);
  const upload=session(configuration.storageSessions.upload,b.uploadUid,b.upload.expiresAt);
  const readback=session(configuration.storageSessions.readback,b.readUid,b.readback.expiresAt);
  if(upload===readback)reject();
  const credential=(token,policy)=>async()=>{const t=time();if(t<policy.startsAt||t>=policy.expiresAt)reject();return token;};
  const handler=createCreatorSyntheticRuntimeIntegration({enabled:true,manifest:b.upload,readManifest:b.readback,postgresConfigs,
   uploadIdentity:credential(upload,b.upload),readbackIdentity:credential(readback,b.readback),publishableKey:configuration.publishableKey,now,fetchImpl});
  return async request=>{
   try{
    const url=new URL(request.url),action=url.pathname.split('/').at(-1),policy=action==='verify'?b.readback:b.upload,t=time();
    if(url.origin!==b.deploymentUrl||t<policy.startsAt||t>=policy.expiresAt)return disabled();
    return await handler(request);
   }catch{return disabled();}
  };
 }catch{reject();}
}

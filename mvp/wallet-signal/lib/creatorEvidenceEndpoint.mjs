// Preparation only; exported through server-only entrypoint, no active app import.
import {readCreatorPreviewIdentity} from './creatorEvidenceEnvironment.mjs';
import {createCreatorEvidencePostgres} from './creatorEvidencePostgres.mjs';
import {screenCreatorGithubToken,createCreatorGithubJwksResolver,verifyCreatorGithubBootstrap,verifyCreatorGithubOidc} from './creatorEvidenceOidc.mjs';
import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
import {validateCreatorSealedBinding} from './creatorEvidenceSealedBinding.mjs';
import {createCreatorServerSession} from './creatorEvidenceServerSession.mjs';
import {createCreatorSyntheticTestIntegration} from './creatorEvidenceSyntheticIntegration.mjs';
const closed=()=>Response.json({status:'DISABLED'},{status:404,headers:{'cache-control':'no-store'}});
export function createCreatorSyntheticEndpoint(options={},dependencies={}){
 if(options.enabled!==true)return async()=>closed();
 // No request-supplied configuration or environment opt-in. Each request reloads
 // the immutable owner seal; do not cache credentials beyond window/closeout.
 return async request=>{
  let handedOff=false;
  try{
   if(typeof window!=='undefined')return closed();
   const url=new URL(request.url),action=url.pathname.split('/').at(-1);
   if(request.method!=='POST'||!['issue','upload','verify'].includes(action)||url.pathname!='/api/creator-evidence-test/'+action||url.search)return closed();
   const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return closed();screenCreatorGithubToken(auth.slice(7));
   const read=dependencies.readVariable??(name=>process.env[name]),deployment=readCreatorPreviewIdentity(read);
   if(url.origin!==deployment.url)return closed();assertCreatorSignal(request.signal);
   const now=dependencies.now??Date.now;
   const jwks=await createCreatorExecutionBudget({maxDurationMs:6000}).run('BOOTSTRAP_AUTH',signal=>createCreatorGithubJwksResolver({enabled:true,fetchImpl:dependencies.fetchImpl??fetch})({signal}),{signal:request.signal});
   assertCreatorSignal(request.signal);
   verifyCreatorGithubBootstrap(auth.slice(7),{deployment,action,jwks,nowSeconds:Math.floor(now()/1000)});
   const purpose=action==='verify'?'verifier':'issuer';
   const clientFor=(role,operation)=>createCreatorEvidencePostgres({enabled:true,purpose:operation,config:{host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',user:'creator_test_'+role+'_login',password:read('CREATOR_TEST_DB_'+role.toUpperCase()+'_PASSWORD'),ca:read('CREATOR_TEST_DB_CA_PEM')}});
   const client=clientFor(purpose,'seal');
   const result=await createCreatorExecutionBudget({maxDurationMs:6000}).run('CONFIGURATION',signal=>client.query({text:'SELECT creator_relay_test_private.relay_session_binding($1::jsonb) AS result',values:[JSON.stringify({...deployment,action})],signal}),{signal:request.signal});
   assertCreatorSignal(request.signal);
   const binding=result?.rows?.length===1?result.rows[0].result:null;
   const b=validateCreatorSealedBinding(binding,{phase:'runtime',nowSeconds:Math.floor(now()/1000)});
   if(b.uploadUid!=='4b4d628a-d0cc-438e-bf04-661d1a5ea546'||b.readUid!=='3393dbd5-209f-4e3b-934d-57006fcdc4fa'||deployment.id!==b.deploymentId||deployment.url!==b.deploymentUrl||deployment.commit!==b.commit||deployment.projectId!==b.vercelProjectId)return closed();
   const phase=action==='verify'?'readback':'upload';
   verifyCreatorGithubOidc(auth.slice(7),{manifest:b[phase],jwks,nowSeconds:Math.floor(now()/1000)});
   // Exact admission precedes body consumption and all Auth credential reads.
   const publishableKey=read('CREATOR_MACHINE_PUBLISHABLE_KEY');
   const lazyClient=(role,operation)=>({query:r=>clientFor(role,operation).query(r)});
   const session=p=>createCreatorServerSession({enabled:true,phase:p,githubToken:auth.slice(7),sealedBinding:b,deployment,publishableKey},
    {now,fetchImpl:dependencies.fetchImpl??fetch,readSecret:read,attemptClient:lazyClient(p==='upload'?'consumer':'verifier','authAttempt')});
   const deny=async()=>{throw Error('CREATOR_SESSION_PHASE_REJECTED');};
   const handler=createCreatorSyntheticTestIntegration({enabled:true,manifest:b.upload,readManifest:b.readback,now,publishableKey,fetchImpl:dependencies.fetchImpl??fetch,
    claimClients:Object.fromEntries(['issuer','consumer','verifier'].map(p=>[p,lazyClient(p,p)])),
    uploadIdentity:action==='upload'?session('upload'):deny,readbackIdentity:action==='verify'?session('readback'):deny});
   handedOff=true;return await handler(request);
  }catch{return handedOff?Response.json({status:'RECONCILIATION_REQUIRED'},{status:409,headers:{'cache-control':'no-store'}}):closed();} // Never retry uncertain work.
 };
}

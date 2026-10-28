// Preparation only; exported through server-only entrypoint, no active app import.
import {createCreatorEnvironmentRuntime,readCreatorPreviewIdentity} from './creatorEvidenceEnvironment.mjs';
import {createCreatorEvidencePostgres} from './creatorEvidencePostgres.mjs';
import {screenCreatorGithubToken} from './creatorEvidenceOidc.mjs';
import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
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
   const purpose=action==='verify'?'verifier':'issuer';
   const client=createCreatorEvidencePostgres({enabled:true,purpose:'configuration',config:{host:'db.acwmtobcbpkjfqiatyke.supabase.co',port:5432,database:'postgres',user:'creator_test_'+purpose+'_login',password:read('CREATOR_TEST_DB_'+purpose.toUpperCase()+'_PASSWORD'),ca:read('CREATOR_TEST_DB_CA_PEM')}});
   const result=await createCreatorExecutionBudget({maxDurationMs:6000}).run('CONFIGURATION',signal=>client.query({text:'SELECT creator_relay_test_private.relay_runtime_configuration($1::jsonb) AS result',values:[JSON.stringify({...deployment,action})],signal}),{signal:request.signal});
   assertCreatorSignal(request.signal);
   const c=result?.rows?.length===1?result.rows[0].result:null;
   if(!c||typeof c!=='object'||Object.keys(c).length!==4||c.phase!==(action==='verify'?'readback':'upload')||!['sealedBinding','storageSessions','publishableKey','phase'].every(k=>Object.hasOwn(c,k)))return closed();
   const handler=createCreatorEnvironmentRuntime({enabled:true,...c},dependencies);
   handedOff=true;return await handler(request);
  }catch{return handedOff?Response.json({status:'RECONCILIATION_REQUIRED'},{status:409,headers:{'cache-control':'no-store'}}):closed();} // Never retry uncertain work.
 };
}

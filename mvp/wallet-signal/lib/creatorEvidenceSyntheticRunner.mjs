import {TEST_OBJECT,TEST_HASH,TEST_REF,TEST_WORKFLOW,testBytes} from './creatorEvidenceTestProfile.mjs';
import {validateCreatorOidcManifest,screenCreatorGithubToken} from './creatorEvidenceOidc.mjs';
import {readCreatorEvidenceBody} from './creatorEvidenceBody.mjs';
import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
const receipt=(status,reconciliationRequired=false)=>({status,reconciliationRequired,retries:0,historicalEvidence:false,scorePromoted:false});
/** One invocation owns one attempt. No loop, refresh, storage token or arbitrary bytes. */
export async function runCreatorSyntheticAttempt(options={},dependencies={}){
 if(options.enabled!==true)return receipt('DISABLED');
 let dispatched=false;
 try{
  const {action,manifest,identity}=options,m=validateCreatorOidcManifest(manifest),now=dependencies.now??Date.now;
  if(!['upload','readback'].includes(action)||m.repository!=='doom404official-collab/DOOM404'||m.ref!==TEST_REF||m.workflow_ref!==m.repository+'/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF||m.run_attempt!=='1'||m.event_name!=='workflow_dispatch'||m.sha!==m.workflow_sha)throw Error();
  for(const key of ['repository','ref','sha','workflow_ref','run_id','run_attempt','event_name'])if(identity?.[key]!==m[key])throw Error();
  const url=new URL(m.audience),suffix=action==='upload'?'/upload':'/verify';
  if(!/^https:\/\/doom404-wallet-signal-[a-z0-9]+-doom-404\.vercel\.app$/.test(url.origin)||url.pathname!='/api/creator-evidence-test'+suffix||url.search||url.hash||url.username||url.password)throw Error();
  const live=()=>{assertCreatorSignal(options.signal);const t=now();if(!Number.isSafeInteger(t)||t<m.startsAt*1000||t>=m.expiresAt*1000)throw Error();return t;};
  live();const fetchImpl=dependencies.fetchImpl??fetch;
  const budget=createCreatorExecutionBudget({maxDurationMs:Math.min(60000,m.expiresAt*1000-now())});
  const token=await budget.run('RUNNER_OIDC',signal=>dependencies.getOidcToken({audience:m.audience,signal}),{signal:options.signal});
  live();screenCreatorGithubToken(token);
  async function post(path,body,capability){
   live();return budget.run('RUNNER_HTTP',async signal=>{
    live();assertCreatorSignal(signal);dispatched=true;
    const response=await fetchImpl(url.origin+'/api/creator-evidence-test/'+path,{method:'POST',redirect:'error',cache:'no-store',headers:{authorization:'Bearer '+token,'content-type':'application/json',...(capability?{'x-creator-capability':capability}:{})},body,signal});
    assertCreatorSignal(signal);live();
    const bytes=await readCreatorEvidenceBody(response,{maxBytes:4096,signal});assertCreatorSignal(signal);live();
    if(!response.ok)throw Error();return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   },{signal:options.signal});
  }
  if(action==='upload'){
   const issued=await post('issue','{}');
   if(!/^[A-Za-z0-9_-]{43}$/.test(issued.capability)||issued.objectKey!==TEST_OBJECT||issued.eligibleForLivePromotion!==false||!Number.isSafeInteger(issued.expiresAt)||issued.expiresAt*1000<=live()||issued.expiresAt>m.expiresAt)throw Error();
   const result=await post('upload',testBytes(),issued.capability);
   if(result.status!=='UPLOAD_REPORTED'||result.eligibleForLivePromotion!==false)throw Error();return receipt('UPLOAD_REPORTED');
  }
  const result=await post('verify','{}');
  if(result.status!=='READBACK_VERIFIED'||result.payloadSha256!==TEST_HASH||result.eligibleForLivePromotion!==false)throw Error();return receipt('READBACK_VERIFIED');
 }catch{return receipt(dispatched?'RECONCILIATION_REQUIRED':'NOT_DISPATCHED',dispatched);}
}
/** GitHub runner transport only. Inputs must come from its trusted Actions env.
 * Does not log/return bearer configuration and never refreshes or retries.
 */
export async function requestCreatorActionsOidc({requestUrl,requestToken,audience,signal,fetchImpl=fetch}){
 const url=new URL(requestUrl);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.actions.githubusercontent.com')||url.username||url.password||url.hash||url.port||typeof requestToken!=='string'||!requestToken||/[\r\n]/.test(requestToken))throw Error('OIDC_REJECTED');
 url.searchParams.set('audience',audience);
 return createCreatorExecutionBudget({maxDurationMs:5000}).run('ACTIONS_OIDC',async inner=>{
  const r=await fetchImpl(url,{headers:{authorization:'Bearer '+requestToken},redirect:'error',cache:'no-store',signal:inner});
  assertCreatorSignal(inner);if(!r.ok)throw Error('OIDC_REJECTED');
  const b=await readCreatorEvidenceBody(r,{maxBytes:32768,signal:inner});assertCreatorSignal(inner);
  const token=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b)).value;screenCreatorGithubToken(token);return token;
 },{signal});
}

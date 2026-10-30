import {TEST_WORKFLOW,TEST_REF} from './creatorEvidenceTestProfile.mjs';
import {readCreatorEvidenceBody} from './creatorEvidenceBody.mjs';
import {createPublicKey,verify,createHash} from 'node:crypto';
export const GITHUB_ISSUER='https://token.actions.githubusercontent.com';
export const GITHUB_JWKS=GITHUB_ISSUER+'/.well-known/jwks';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fields=['repository','repository_id','repository_owner','repository_owner_id','ref','sha','workflow_ref','workflow_sha','run_id','run_attempt','event_name','environment','runner_environment','sub'];
const fail=()=>{throw Error('CREATOR_OIDC_REJECTED');};
function decode(segment){
 if(typeof segment!=='string'||!segment||!/^[A-Za-z0-9_-]+$/.test(segment))fail();
 const bytes=Buffer.from(segment,'base64url');if(bytes.toString('base64url')!==segment)fail();return bytes;
}
function json(segment){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(decode(segment));const parsed=JSON.parse(text);
 // Reject duplicate keys, including escaped aliases; JSON.parse alone keeps the last.
 const tokens=text.match(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g)||[];let at=0;
 function value(depth=0){if(depth>16)fail();const token=tokens[at++];if(token==='{'){const seen=new Set();if(tokens[at]==='}'){at++;return;}while(true){const key=JSON.parse(tokens[at++]);if(seen.has(key)||tokens[at++]!==':')fail();seen.add(key);value(depth+1);if(tokens[at++]==='}')break;}}else if(token==='['){if(tokens[at]===']'){at++;return;}while(true){value(depth+1);if(tokens[at++]===']')break;}}}
 value();if(at!==tokens.length||!object(parsed))fail();return parsed;
}
export function validateCreatorOidcManifest(manifest){
 if(!object(manifest)||fields.some(k=>typeof manifest[k]!=='string'||!manifest[k])||typeof manifest.audience!=='string'||!manifest.audience.startsWith('https://'))fail();
 for(const key of ['repository_id','repository_owner_id','run_id','run_attempt'])if(!/^[1-9][0-9]*$/.test(manifest[key]))fail();
 for(const key of ['sha','workflow_sha'])if(!/^[a-f0-9]{40}$/.test(manifest[key]))fail();
 if(manifest.event_name!=='workflow_dispatch'||manifest.run_attempt!=='1'||manifest.runner_environment!=='github-hosted'||!manifest.ref.startsWith('refs/heads/'))fail();
 if(!['creator-global-restricted-capture.yml',TEST_WORKFLOW].some(workflow=>manifest.workflow_ref===manifest.repository+'/.github/workflows/'+workflow+'@'+manifest.ref))fail();
 if((manifest.job_workflow_ref===undefined)!==(manifest.job_workflow_sha===undefined))fail();
 if(manifest.job_workflow_ref!==undefined&&(typeof manifest.job_workflow_ref!=='string'||!/^[a-f0-9]{40}$/.test(manifest.job_workflow_sha)))fail();
 if(!Number.isSafeInteger(manifest.startsAt)||manifest.startsAt<0||!Number.isSafeInteger(manifest.expiresAt)||manifest.expiresAt<=manifest.startsAt||manifest.expiresAt-manifest.startsAt>300)fail();
 return structuredClone(manifest);
}
/** Syntax/header screening only; never an authentication result. Reject before JWKS I/O. */
export function screenCreatorGithubToken(token){
 try{
  if(typeof token!=='string'||token.length>16384)fail();
  const parts=token.split('.');if(parts.length!==3)fail();const header=json(parts[0]);json(parts[1]);decode(parts[2]);
  if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string'||!header.kid||Object.keys(header).some(k=>!['alg','typ','kid','x5t'].includes(k)))fail();
 }catch{fail();}
}
/** No trust in token-provided URLs. jwks must come from the server's pinned resolver. */
export function verifyCreatorGithubOidc(token,{manifest,jwks,nowSeconds}={}){
 try{
  screenCreatorGithubToken(token);const expected=validateCreatorOidcManifest(manifest);
  if(!Number.isSafeInteger(nowSeconds)||nowSeconds<expected.startsAt||nowSeconds>=expected.expiresAt||typeof token!=='string'||token.length>16384)fail();
  const parts=token.split('.');if(parts.length!==3)fail();const header=json(parts[0]),claims=json(parts[1]);
  if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string'||!header.kid||Object.keys(header).some(k=>!['alg','typ','kid','x5t'].includes(k)))fail();
  if(!Array.isArray(jwks?.keys)||jwks.keys.length>20)fail();const keys=jwks.keys.filter(k=>k?.kid===header.kid);if(keys.length!==1)fail();const key=keys[0];
  if(key.kty!=='RSA'||key.use!=='sig'||(key.alg!==undefined&&key.alg!=='RS256')||key.d!==undefined||(key.key_ops!==undefined&&(!Array.isArray(key.key_ops)||key.key_ops.length!==1||key.key_ops[0]!=='verify')))fail();
  const publicKey=createPublicKey({key,format:'jwk'});if(!Number.isInteger(publicKey.asymmetricKeyDetails?.modulusLength)||publicKey.asymmetricKeyDetails.modulusLength<2048||publicKey.asymmetricKeyDetails.modulusLength>8192)fail();
  if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),publicKey,decode(parts[2])))fail();
  if(claims.iss!==GITHUB_ISSUER||claims.aud!==expected.audience||fields.some(k=>claims[k]!==expected[k]))fail();
  for(const key of ['job_workflow_ref','job_workflow_sha'])if(claims[key]!==expected[key])fail();
  if(['iat','nbf','exp'].some(k=>!Number.isSafeInteger(claims[k])||claims[k]<0)||claims.iat>nowSeconds||claims.nbf>nowSeconds||claims.exp<=nowSeconds||claims.exp<=claims.iat||nowSeconds-claims.iat>600||claims.nbf>claims.exp||typeof claims.jti!=='string'||!claims.jti||claims.jti.length>256)fail();
  return Object.freeze({runId:claims.run_id,runAttempt:claims.run_attempt,commit:claims.sha,expiresAt:Math.min(claims.exp,expected.expiresAt),tokenIdHash:createHash('sha256').update(claims.jti).digest('hex')});
 }catch{fail();}
}
/** Disabled unless explicitly constructed for an approved integration or offline test. */
export function createCreatorGithubJwksResolver({enabled=false,fetchImpl=fetch}={}){
 if(enabled!==true)throw Error('CREATOR_JWKS_DISABLED');
 return async({signal}={})=>{
  try{
   const response=await fetchImpl(GITHUB_JWKS,{redirect:'error',cache:'no-store',headers:{'accept-encoding':'identity'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000)});
   if(!response.ok)fail();const bytes=await readCreatorEvidenceBody(response,{maxBytes:65536,signal});const keys=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!Array.isArray(keys.keys)||keys.keys.length>20)fail();return keys;
  }catch{fail();}
 };
}

/** Stage one authenticates the fixed deployment/workflow principal, NOT run admission.
 * run_id is signer-asserted here; the installed seal must independently match it.
 * The one-second manifest interval is a verification instant, never an approved window.
 */
export function verifyCreatorGithubBootstrap(token,{deployment,action,jwks,nowSeconds}={}){
 try{
  screenCreatorGithubToken(token);
  if(!['issue','upload','verify'].includes(action)||!Number.isSafeInteger(nowSeconds)||nowSeconds<0)fail();
  const claims=json(token.split('.')[1]);
  const repository='doom404official-collab/DOOM404',environment='creator-evidence-synthetic-test';
  return verifyCreatorGithubOidc(token,{jwks,nowSeconds,manifest:{
   repository,repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',
   ref:TEST_REF,sha:deployment.commit,workflow_sha:deployment.commit,
   workflow_ref:repository+'/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF,
   run_id:claims.run_id,run_attempt:'1',event_name:'workflow_dispatch',environment,runner_environment:'github-hosted',
   sub:'repo:'+repository+':environment:'+environment,
   audience:deployment.url+'/api/creator-evidence-test/'+(action==='verify'?'verify':'upload'),
   startsAt:nowSeconds,expiresAt:nowSeconds+1
  }});
 }catch{fail();}
}

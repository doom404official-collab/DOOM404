// Pure review-artifact preparation. Never executes SQL or activates a route.
import {readFileSync} from 'node:fs';
import {validateCreatorOidcManifest} from './creatorEvidenceOidc.mjs';
import {TEST_OBJECT,TEST_HASH,TEST_REF,TEST_WORKFLOW} from './creatorEvidenceTestProfile.mjs';
const fail=()=>{throw Error('CREATOR_SEALED_BINDING_REJECTED');};
const fields=['version','projectRef','vercelProjectId','deploymentId','deploymentUrl','commit','approvalRef','uploadUid','readUid','objectKey','payloadSha256','byteLength','upload','readback'];
const manifestFields=['repository','repository_id','repository_owner','repository_owner_id','ref','sha','workflow_ref','workflow_sha','run_id','run_attempt','event_name','environment','runner_environment','sub','audience','startsAt','expiresAt'];
export function validateCreatorSealedBinding(binding,{nowSeconds=Math.floor(Date.now()/1000)}={}){
 try{
  if(!binding||typeof binding!=='object'||Array.isArray(binding)||Object.keys(binding).length!==fields.length||fields.some(k=>!Object.hasOwn(binding,k))||!Number.isSafeInteger(nowSeconds)||nowSeconds<0)fail();
  const b=structuredClone(binding);
  for(const field of fields.filter(k=>!['version','byteLength','upload','readback'].includes(k)))if(typeof b[field]!=='string')fail();
  if(b.version!==1||b.projectRef!=='acwmtobcbpkjfqiatyke'||b.vercelProjectId!=='prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e'||!/^dpl_[A-Za-z0-9]{1,100}$/.test(b.deploymentId)||!/^https:\/\/doom404-wallet-signal-[a-z0-9]+-doom-404\.vercel\.app$/.test(b.deploymentUrl)||!/^[a-f0-9]{40}$/.test(b.commit)||typeof b.approvalRef!=='string'||!b.approvalRef.trim()||b.approvalRef.length>256)fail();
  if(b.objectKey!==TEST_OBJECT||b.payloadSha256!==TEST_HASH||b.byteLength!==75)fail();
  for(const uid of [b.uploadUid,b.readUid])if(typeof uid!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(uid))fail();
  if(b.uploadUid===b.readUid)fail();
  for(const [name,path] of [['upload','upload'],['readback','verify']]){
   const m=validateCreatorOidcManifest(b[name]);
   if(Object.keys(m).length!==manifestFields.length||manifestFields.some(k=>!Object.hasOwn(m,k))||m.repository!=='doom404official-collab/DOOM404'||m.repository_id!=='1405094598'||m.repository_owner!=='doom404official-collab'||m.repository_owner_id!=='335732040'||m.ref!==TEST_REF||m.workflow_ref!==m.repository+'/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF||m.sha!==b.commit||m.workflow_sha!==b.commit||m.audience!==b.deploymentUrl+'/api/creator-evidence-test/'+path||m.startsAt<nowSeconds||m.expiresAt<=nowSeconds)fail();
  }
  if(b.upload.run_id===b.readback.run_id||JSON.stringify(b).length>16384)fail();return b;
 }catch{fail();}
}
export function renderCreatorSealedTransition(binding,options){
 const b=validateCreatorSealedBinding(binding,options);
 const json=JSON.stringify(b).replaceAll("'","''");
 return "BEGIN;\nCREATE TEMP TABLE creator_test_approved_bindings(binding jsonb NOT NULL) ON COMMIT DROP;\nINSERT INTO creator_test_approved_bindings VALUES ('"+json+"'::jsonb);\n"+readFileSync(new URL('../docs/proposals/creator-evidence-sealed-transition.sql',import.meta.url),'utf8');
}

import {TEST_OBJECT,TEST_HASH,TEST_REF,TEST_WORKFLOW} from '../../../lib/creatorEvidenceTestProfile.mjs';
export const U='4b4d628a-d0cc-438e-bf04-661d1a5ea546',R='3393dbd5-209f-4e3b-934d-57006fcdc4fa';
export function binding(time){
 const url='https://doom404-wallet-signal-synthetic-doom-404.vercel.app';
 const m={repository:'doom404official-collab/DOOM404',repository_id:'1405094598',repository_owner:'doom404official-collab',repository_owner_id:'335732040',ref:TEST_REF,sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),workflow_ref:'doom404official-collab/DOOM404/.github/workflows/'+TEST_WORKFLOW+'@'+TEST_REF,run_id:'123456',run_attempt:'1',event_name:'workflow_dispatch',environment:'creator-evidence-synthetic-test',runner_environment:'github-hosted',sub:'repo:doom404official-collab/DOOM404:environment:creator-evidence-synthetic-test',audience:url+'/api/creator-evidence-test/upload',startsAt:time+120,expiresAt:time+240};
 return {version:1,projectRef:'acwmtobcbpkjfqiatyke',vercelProjectId:'prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e',deploymentId:'dpl_synthetic',deploymentUrl:url,commit:m.sha,approvalRef:'SYNTHETIC_NOT_APPROVAL',uploadUid:U,readUid:R,objectKey:TEST_OBJECT,payloadSha256:TEST_HASH,byteLength:75,upload:m,readback:{...m,run_id:'123457',audience:url+'/api/creator-evidence-test/verify'}};
}
export function response(uid,time,claims={},extra={}){
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 return {access_token:enc({alg:'RS256'})+'.'+enc({iss:'https://acwmtobcbpkjfqiatyke.supabase.co/auth/v1',sub:uid,role:'authenticated',aud:'authenticated',is_anonymous:false,aal:'aal1',iat:time,exp:time+600,...claims})+'.c3ludGhldGlj',refresh_token:'SYNTHETIC_REFRESH_NEVER_RETAIN',token_type:'bearer',expires_in:600,expires_at:time+600,user:{id:uid,role:'authenticated',is_anonymous:false},...extra};
}

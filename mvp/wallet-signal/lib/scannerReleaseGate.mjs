export const SCANNER_RELEASE={repository:'doom404official-collab/DOOM404',branch:'integration/glitch-app-main-20261118',project:'prj_AbsbiTw8Kc8axGpZ3FFpH9VvDS4e',environment:'Production – doom404-wallet-signal'};
export function validateReviewedScannerRelease({reviewedSha,contextSha,checkedOutSha,repository,branch,event,candidate,checks,ownerAuthorized,environment}){
 const reject=code=>{throw Error(code);};
 if(repository!==SCANNER_RELEASE.repository||branch!==SCANNER_RELEASE.branch||event!=='workflow_dispatch')reject('UNTRUSTED_RELEASE_CONTEXT');
 if(!/^[a-f0-9]{40}$/.test(reviewedSha||''))reject('MISSING_REVIEWED_SHA');
 if(reviewedSha!==contextSha||reviewedSha!==checkedOutSha||reviewedSha!==candidate?.sha)reject('REVIEWED_SHA_MISMATCH');
 if(candidate.project!==SCANNER_RELEASE.project||candidate.branch!==SCANNER_RELEASE.branch||!/^dpl_[A-Za-z0-9]{10,100}$/.test(candidate.deployment||''))reject('CANDIDATE_IDENTITY_MISMATCH');
 const url=new URL(candidate.url);if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||!/^doom404-wallet-signal-[a-z0-9]+-doom-404\.vercel\.app$/.test(url.hostname)||url.pathname!=='/')reject('UNTRUSTED_CANDIDATE_URL');
 for(const name of ['scanner-security','scanner-regression']){
  const rows=(checks||[]).filter(x=>x.name===name&&x.app?.slug==='github-actions'&&x.head_sha===reviewedSha).sort((a,b)=>b.id-a.id);
  if(!rows.length||rows[0].status!=='completed'||rows[0].conclusion!=='success')reject('REQUIRED_CHECK_NOT_PASSED:'+name);
 }
 if(ownerAuthorized!==true||environment!==SCANNER_RELEASE.environment)reject('OWNER_AUTHORIZATION_REQUIRED');
 return {status:'APPROVED_FOR_PROMOTION_CHECK',sha:reviewedSha,deployment:candidate.deployment,project:candidate.project};
}

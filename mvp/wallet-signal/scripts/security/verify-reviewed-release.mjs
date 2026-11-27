import {execFileSync} from 'node:child_process';
import {validateReviewedScannerRelease,SCANNER_RELEASE} from '../../lib/scannerReleaseGate.mjs';
const env=process.env,sha=env.REVIEWED_SHA,url=env.CANDIDATE_URL,id=env.CANDIDATE_DEPLOYMENT_ID;
if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('MISSING_REVIEWED_SHA');
const parsed=new URL(url);if(parsed.origin+'/'!==url||!/^https:\/\/doom404-wallet-signal-[a-z0-9]+-doom-404\.vercel\.app\/$/.test(url))throw Error('UNTRUSTED_CANDIDATE_URL');
if(!env.GITHUB_TOKEN||!env.VERCEL_AUTOMATION_BYPASS_SECRET)throw Error('RELEASE_VALIDATION_CONFIGURATION_MISSING');
const response=await fetch(url+'api/token-current?mint=invalid',{headers:{'x-vercel-protection-bypass':env.VERCEL_AUTOMATION_BYPASS_SECRET},redirect:'error',signal:AbortSignal.timeout(15000)});
if(response.status!==400||response.headers.get('x-glitch-rpc-requests')!=='0')throw Error('CANDIDATE_SMOKE_FAILED');
const checks=[];for(let page=1;page<=3;page++){
 const r=await fetch('https://api.github.com/repos/'+SCANNER_RELEASE.repository+'/commits/'+sha+'/check-runs?per_page=100&page='+page,{headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('CHECKS_UNAVAILABLE');const body=await r.json();checks.push(...body.check_runs);if(body.check_runs.length<100)break;
}
const result=validateReviewedScannerRelease({reviewedSha:sha,contextSha:env.GITHUB_SHA,checkedOutSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),repository:env.GITHUB_REPOSITORY,branch:env.GITHUB_REF_NAME,event:env.GITHUB_EVENT_NAME,candidate:{sha:response.headers.get('x-glitch-commit'),deployment:response.headers.get('x-glitch-deployment'),project:response.headers.get('x-glitch-project'),branch:response.headers.get('x-glitch-branch'),url},checks,ownerAuthorized:env.AUTHORIZE_PRODUCTION==='true',environment:env.RELEASE_ENVIRONMENT});
if(result.deployment!==id)throw Error('CANDIDATE_DEPLOYMENT_MISMATCH');
console.log(JSON.stringify(result));
// Intentionally no Vercel production credential, deployment or promotion call.

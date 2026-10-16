// Safe live POST probe: deliberately invalid mint; cannot initiate a real scan.
const base=process.env.GLITCH_PREVIEW_URL;
const bypass=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const expectedHost='doom404-wallet-signal-git-feature-glitch-holder-9f3530-doom-404.vercel.app';
if(!base||new URL(base).hostname!==expectedHost||!bypass)throw Error('DIAGNOSTIC_CONFIGURATION_MISSING');
const response=await fetch(base.replace(/\/$/,'')+'/api/token/deep-scan',{
 method:'POST',redirect:'manual',
 headers:{'Content-Type':'application/json','x-vercel-protection-bypass':bypass},
 body:JSON.stringify({mint:'invalid-mint'}),
 signal:AbortSignal.timeout(12000)
});
const status=response.status;
const body=await response.json().catch(()=>null);
const accepted=(status===503&&body?.status==='disabled')||(status===400&&body?.error==='invalid_mint');
console.log(JSON.stringify({status,bodyStatus:body?.status??null,errorCode:body?.error??null,
 accepted,scope:'invalid mint only; no valid token scan or Helius requests'}));
if(!accepted)process.exitCode=1;

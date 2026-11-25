const {synthesize}=require("../lib/editorial-synthesis");
const {review}=require("../lib/editorial-validation");
const {buildEvidence}=require("../lib/editorial-evidence");
module.exports=async(req,res)=>{
res.setHeader("Cache-Control","no-store");
if(process.env.VERCEL_ENV!=="preview"||req.method!=="POST")return res.status(404).end();
const start=Date.now(),stages=[];let stage="input",attempt=0;
const finish=(status,reason,extra={})=>res.status(200).json({status,reason,diagnostics:{stage,attempt,elapsedMs:Date.now()-start,stages},...extra});
const report=req.body?.report;
if(!report||report.eligible!==true||!Array.isArray(report.scenes)||report.scenes.length!==7)return res.status(400).json({status:"INVALID_REPORT",diagnostics:{stage}});
const bytes=Buffer.byteLength(JSON.stringify(report));stages.push({stage,bytes});
if(bytes>250000)return finish("DETERMINISTIC_FALLBACK","REPORT_TOO_LARGE");
const key=process.env.OPENAI_EDITORIAL_API_KEY,model=process.env.OPENAI_EDITORIAL_MODEL;
if(!key||!model)return finish("DETERMINISTIC_FALLBACK","CONFIG_MISSING");
try{stage="evidence";const e=buildEvidence(report);stages.push({stage,bytes:Buffer.byteLength(JSON.stringify(e)),facts:e.facts.length,coverage:e.coverage});let correction=null;
for(attempt=1;attempt<=2;attempt++){stage="generation";let t=Date.now();const result=await synthesize(report,{key,model,correction});stages.push({stage,attempt,ms:Date.now()-t,usage:result.usage});stage="review";t=Date.now();const audit=await review(result.draft,result.evidence,{key,model});stages.push({stage,attempt,ms:Date.now()-t,approved:audit.approved,issueCount:audit.issues.length,issues:audit.issues.slice(0,8).map(x=>String(x).replace(/sk-[A-Za-z0-9_-]+/g,"[redacted]").slice(0,300))});if(audit.approved)return finish("AI_REVIEW_PASSED",null,{draft:result.draft,attempt,mint:report.mint});correction={draft:result.draft,issues:audit.issues};}
return finish("DETERMINISTIC_FALLBACK","REVIEW_REJECTED");}catch(err){const msg=String(err?.message||"");const reason=/^(EVIDENCE_TOO_LARGE|EDITORIAL_PROVIDER_ERROR_\d{3}|EDITORIAL_INCOMPLETE|EDITORIAL_SCHEMA_OR_REFERENCE_INVALID|REVIEW_PROVIDER_ERROR|REVIEW_INCOMPLETE)$/.test(msg)?msg:err?.name==="TimeoutError"?"UPSTREAM_TIMEOUT":err instanceof SyntaxError?"INVALID_JSON":"STAGE_FAILED";return finish("DETERMINISTIC_FALLBACK",reason);}
};
const {synthesize}=require("../lib/editorial-synthesis");
const {review}=require("../lib/editorial-validation");
module.exports=async(req,res)=>{
res.setHeader("Cache-Control","no-store");
if(process.env.VERCEL_ENV!=="preview"||req.method!=="POST")return res.status(404).end();
const report=req.body?.report;
if(!report||report.eligible!==true||!Array.isArray(report.scenes)||report.scenes.length!==7||JSON.stringify(report).length>250000)return res.status(400).json({status:"INVALID_REPORT"});
const key=process.env.OPENAI_EDITORIAL_API_KEY,model=process.env.OPENAI_EDITORIAL_MODEL;
if(!key||!model)return res.status(200).json({status:"DETERMINISTIC_FALLBACK",reason:"CONFIG_MISSING"});
try{let correction=null;for(let attempt=1;attempt<=2;attempt++){const result=await synthesize(report,{key,model,correction});const audit=await review(result.draft,result.evidence,{key,model});if(audit.approved)return res.status(200).json({status:"AI_REVIEW_PASSED",draft:result.draft,attempt,mint:report.mint});correction={draft:result.draft,issues:audit.issues};}return res.status(200).json({status:"DETERMINISTIC_FALLBACK",reason:"REVIEW_REJECTED"});}catch{return res.status(200).json({status:"DETERMINISTIC_FALLBACK",reason:"EDITORIAL_UNAVAILABLE"});}
};
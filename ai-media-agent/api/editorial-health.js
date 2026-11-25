module.exports=async(req,res)=>{
res.setHeader("Cache-Control","no-store");
if(process.env.VERCEL_ENV!=="preview"||req.method!=="POST")return res.status(404).end();
const key=process.env.OPENAI_EDITORIAL_API_KEY,model=process.env.OPENAI_EDITORIAL_MODEL;
if(!key||!model)return res.status(503).json({status:"CONFIG_MISSING"});
try{const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model,input:"Return the single word READY.",max_output_tokens:128,store:false}),signal:AbortSignal.timeout(20000)});const d=await r.json();return res.status(r.ok?200:502).json({status:r.ok&&d.status==="completed"?"MODEL_RESPONSE_COMPLETED":"MODEL_RESPONSE_NOT_COMPLETED",upstreamStatus:r.status,model,usage:d.usage||null});}catch{return res.status(502).json({status:"REQUEST_FAILED"})}
};
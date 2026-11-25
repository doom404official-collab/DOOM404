"use strict";
const crypto=require("node:crypto");
const {isIP}=require("node:net");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function admit(req,res,purpose,nonce){
 if(typeof nonce!=="string"||!UUID.test(nonce)||!["research","narration"].includes(purpose)){res.status(400).json({error:"INVALID_ADMISSION_NONCE"});return false;}
 try{
 const url=new URL(process.env.SUPABASE_URL),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(url.protocol!=="https:"||!url.hostname.endsWith(".supabase.co")||!key||process.env.VERCEL_ENV!=="preview")throw Error("CONFIG");
 // Vercel supplies this header. Never fall back to client-selected proxy headers.
 const raw=req.headers?.["x-vercel-forwarded-for"];
 if(typeof raw!=="string"||!isIP(raw.trim()))throw Error("CLIENT_IDENTITY");
 const ip=isIP(raw.trim())===6?new URL("http://["+raw.trim()+"]").hostname:raw.trim();
 const digest=crypto.createHmac("sha256",key).update(ip).digest("hex");
 const response=await fetch(new URL("/rest/v1/rpc/ai_media_v16_preview_admit",url),{method:"POST",redirect:"error",headers:{apikey:key,...(key.startsWith("sb_secret_")?{}:{Authorization:"Bearer "+key}),"Content-Type":"application/json"},body:JSON.stringify({p_purpose:purpose,p_digest:digest,p_nonce:nonce}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error("UPSTREAM");
 const {status}=await response.json();
 if(status==="ADMITTED")return true;
 if(status==="REPLAY"){res.status(409).json({error:"ADMISSION_REPLAY"});return false;}
 if(status==="RATE_LIMIT"){res.status(429).json({error:"ADMISSION_RATE_LIMIT"});return false;}
 if(status==="INVALID"){res.status(400).json({error:"INVALID_ADMISSION"});return false;}
 throw Error("UNKNOWN");
 }catch{res.status(503).json({error:"DURABLE_ADMISSION_UNAVAILABLE"});return false;}
}
module.exports={admit};


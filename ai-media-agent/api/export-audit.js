// Reusable preview QA for audio extracted from an actual narrated export.
// Requires Vercel Deployment Protection, like api/narration.js. Never expose
// on an unprotected production/custom domain. No expected script is accepted.
// API: https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create
const crypto=require("crypto");
const MAX_BYTES=1500000,MAX_BASE64=4*Math.ceil(MAX_BYTES/3),HOUR=3600000;
let requests=[];
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({error:"POST_ONLY"});
  if(process.env.VERCEL_ENV!=="preview"||!process.env.OPENAI_API_KEY)return res.status(503).json({error:"EXPORT_AUDIT_PREVIEW_ONLY"});
  const origin=req.headers.origin||"",host=req.headers.host||"";
  if(!origin||origin!=="https://"+host)return res.status(403).json({error:"SAME_ORIGIN_REQUIRED"});
  let body=req.body;
  if(typeof body==="string"){
    if(body.length>MAX_BASE64+100)return res.status(413).json({error:"AUDIO_TOO_LARGE"});
    try{body=JSON.parse(body)}catch{return res.status(400).json({error:"INVALID_JSON"})}
  }
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(k=>!["audioBase64","mimeType","model"].includes(k))||body.mimeType!=="audio/mpeg"||typeof body.audioBase64!=="string")return res.status(400).json({error:"MP3_AUDIO_ONLY_NO_SCRIPT"});
  const model=body.model===undefined?"whisper-1":body.model;
  if(!["whisper-1","gpt-4o-mini-transcribe"].includes(model))return res.status(400).json({error:"TRANSCRIPTION_MODEL_NOT_ALLOWED"});
  const encoded=body.audioBase64;
  if(encoded.length>MAX_BASE64)return res.status(413).json({error:"AUDIO_TOO_LARGE"});
  if(!encoded.length||encoded.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return res.status(400).json({error:"INVALID_BASE64"});
  const audio=Buffer.from(encoded,"base64");
  if(audio.length>MAX_BYTES)return res.status(413).json({error:"AUDIO_TOO_LARGE"});
  if(audio.length<128||audio.toString("base64")!==encoded||!(audio.subarray(0,3).toString("ascii")==="ID3"||(audio[0]===255&&(audio[1]&224)===224)))return res.status(400).json({error:"INVALID_MP3"});
  const now=Date.now();requests=requests.filter(t=>now-t<HOUR);
  // Hard cap per warm function instance. Deployment Protection is the access
  // boundary; this local cap is not a distributed account-wide quota.
  if(requests.length>=3){res.setHeader("Retry-After",String(Math.ceil((HOUR-(now-requests[0]))/1000)));return res.status(429).json({error:"EXPORT_AUDIT_RATE_LIMIT"})}
  requests.push(now);
  try{
    const form=new FormData();
    form.append("file",new File([audio],"export-sample.mp3",{type:"audio/mpeg"}));
    form.append("model",model);
    form.append("response_format",model==="whisper-1"?"verbose_json":"json");
    form.append("language","en");
    if(model==="whisper-1")form.append("timestamp_granularities[]","segment");
    // No prompt, reference script or captions: avoid contaminating the audit.
    const upstream=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY},body:form,signal:AbortSignal.timeout(45000)});
    if(!upstream.ok)return res.status(502).json({error:"TRANSCRIPTION_PROVIDER_FAILED",providerStatus:upstream.status});
    const result=await upstream.json();
    const duration=Number.isFinite(result.duration)&&result.duration>0&&result.duration<=180?result.duration:null;
    if(typeof result.text!=="string"||!result.text.trim()||result.text.length>20000||(model==="whisper-1"&&(!duration||!Array.isArray(result.segments)))||(result.duration!==undefined&&duration===null))return res.status(502).json({error:"TRANSCRIPTION_RESPONSE_INVALID"});
    const segments=(Array.isArray(result.segments)?result.segments:[]).slice(0,1000).filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.start>=0&&s.end>=s.start&&s.end<=(duration??180)+1&&typeof s.text==="string").map(s=>({start:s.start,end:s.end,text:s.text.slice(0,2000)}));
    return res.status(200).json({model,audit:"UNPROMPTED_EXPORTED_AUDIO_TRANSCRIPTION",observedAt:new Date().toISOString(),audioSha256:crypto.createHash("sha256").update(audio).digest("hex"),audioBytes:audio.length,text:result.text,duration,segments,timingAvailability:segments.length?"PROVIDER_SEGMENTS_RETURNED":"NO_SEGMENT_TIMESTAMPS_RETURNED",limitation:"Machine transcription supports intelligibility and timing review; compare with the actual export and its caption timeline. It does not independently establish factual accuracy or perfect synchronization."});
  }catch(e){return res.status(503).json({error:e.name==="TimeoutError"?"TRANSCRIPTION_TIMEOUT":"TRANSCRIPTION_UNAVAILABLE"})}
};

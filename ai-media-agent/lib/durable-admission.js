"use strict";
const crypto=require('node:crypto');
const ENDPOINT='https://acwmtobcbpkjfqiatyke.supabase.co/functions/v1/ai-media-v16-preview-admission';
function signingKey(key=process.env.OPENAI_EDITORIAL_API_KEY){if(!key)throw Error('CONFIG_MISSING');const seed=crypto.createHmac('sha256',key).update('doom404:v16:preview-admission:ed25519').digest();return crypto.createPrivateKey({format:'der',type:'pkcs8',key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),seed])})}
function publicKey(key){return crypto.createPublicKey(signingKey(key)).export({format:'der',type:'spki'}).toString('base64')}
async function admit(req,purpose,nonce,{fetcher=fetch,key=process.env.OPENAI_EDITORIAL_API_KEY}={}){
 if(!['research','narration'].includes(purpose)||typeof nonce!=='string'||!/^[-a-f0-9]{36}$/i.test(nonce))return {ok:false,status:400,error:'INVALID_ADMISSION'};
 try{const digest=crypto.createHmac('sha256',key).update('doom404:preview-client:'+String(req.headers?.['x-forwarded-for']||'unknown').split(',')[0]).digest('hex');
 const body=JSON.stringify({environment:'preview',purpose,nonce,digest,ts:Date.now()});const signature=crypto.sign(null,Buffer.from(body),signingKey(key)).toString('base64');
 const r=await fetcher(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-DOOM404-Signature':signature},body,redirect:'error',signal:AbortSignal.timeout(8000)});const d=await r.json();
 if(r.ok&&d.status==='ADMITTED')return {ok:true,scope:'DURABLE_PREVIEW_QUOTA'};
 return {ok:false,status:r.status===409?409:r.status===429?429:503,error:r.status===409?'ADMISSION_REPLAY':r.status===429?'PREVIEW_RATE_LIMIT':'ADMISSION_UNAVAILABLE'};
 }catch{return {ok:false,status:503,error:'ADMISSION_UNAVAILABLE'}}
}
module.exports={admit,publicKey};

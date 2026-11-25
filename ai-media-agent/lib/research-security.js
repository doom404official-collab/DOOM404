"use strict";
const crypto=require('node:crypto');
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SESSION=/^[a-f0-9-]{36}$/i;
// Preview defense in depth. Deployment Protection is the authentication boundary.
// Instance limits do not claim globally durable quotas.
const recent=new Map(),consumed=new Map();
function gate(req,res,{limit=6,bytes=4096}={}){
 res.setHeader('Cache-Control','no-store');
 if(process.env.VERCEL_ENV!=='preview'||req.method!=='POST'){res.status(404).end();return false;}
 const origin=req.headers?.origin,host=req.headers?.host;
 if(!origin||origin!=='https://'+host){res.status(403).json({error:'SAME_ORIGIN_REQUIRED'});return false;}
 if(Buffer.byteLength(JSON.stringify(req.body||{}))>bytes){res.status(413).json({error:'REQUEST_TOO_LARGE'});return false;}
 const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];
 const id=crypto.createHash('sha256').update(ip).digest('hex'),now=Date.now();
 for(const [k,v] of recent)if(v.until<now)recent.delete(k);
 const counter=recent.get(id)||{count:0,until:now+3600000};
 if(counter.count>=limit||recent.size>10000){res.status(429).json({error:'REQUEST_RATE_LIMIT'});return false;}
 counter.count++;recent.set(id,counter);return true;
}
function key(){const k=process.env.OPENAI_EDITORIAL_API_KEY;if(!k)throw Error('CONFIG_MISSING');return crypto.createHmac('sha256',k).update('doom404-v16-evidence-ticket-v1').digest();}
function sign(data){const payload=Buffer.from(JSON.stringify({...data,expires:Date.now()+30*60000,nonce:crypto.randomUUID()})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',key()).update(payload).digest('base64url');}
function verify(ticket,{mint,sessionId,purpose},consume=false){
 if(typeof ticket!=='string'||ticket.length>15000)throw Error('INVALID_SNAPSHOT');
 const [payload,sig,...extra]=ticket.split('.');if(extra.length||!sig)throw Error('INVALID_SNAPSHOT');
 const expected=crypto.createHmac('sha256',key()).update(payload).digest();const actual=Buffer.from(sig,'base64url');
 if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw Error('SNAPSHOT_INTEGRITY_FAILED');
 const data=JSON.parse(Buffer.from(payload,'base64url').toString());
 if(data.expires<Date.now()||data.expires>Date.now()+31*60000||data.mint!==mint||data.sessionId!==sessionId||data.purpose!==purpose)throw Error('SNAPSHOT_BINDING_FAILED');
 for(const [k,v] of consumed)if(v<Date.now())consumed.delete(k);
 if(consumed.has(data.nonce))throw Error('SNAPSHOT_REPLAY');
 if(consume){if(consumed.size>10000)throw Error('REPLAY_CAPACITY');consumed.set(data.nonce,data.expires);}
 return data;
}
module.exports={gate,sign,verify,MINT,SESSION};

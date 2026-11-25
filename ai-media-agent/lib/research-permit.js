"use strict";
const crypto=require('node:crypto');
const {clientDigest}=require('./durable-admission');
const {MINT,SESSION}=require('./research-security');
const VALIDITY_MS=300000, CLOCK_SKEW_MS=15000;
function key(){
 const secret=process.env.OPENAI_EDITORIAL_API_KEY;
 if(!secret)throw Error('PERMIT_CONFIG');
 return crypto.createHmac('sha256',secret).update('doom404-research-permit-v1').digest();
}
function binding(req){return crypto.createHmac('sha256',key()).update(clientDigest(req)).digest('base64url');}
function issue(req,mint,previous){
 if(!MINT.test(mint))throw Error('PERMIT_MINT');
 const issuedAt=previous?previous.issuedAt:Date.now();
 if(issuedAt+VALIDITY_MS<=Date.now())throw Error('PERMIT_EXPIRED');
 // Reissues preserve the original session's fixed validity window.
 const data={version:1,purpose:'research',mint,sessionId:previous?previous.sessionId:crypto.randomUUID(),nonce:crypto.randomUUID(),issuedAt,expiresAt:issuedAt+VALIDITY_MS,clientBinding:binding(req)};
 const payload=Buffer.from(JSON.stringify(data)).toString('base64url');
 return {researchPermit:payload+'.'+crypto.createHmac('sha256',key()).update(payload).digest('base64url'),sessionId:data.sessionId,expiresAt:data.expiresAt};
}
function verify(req,ticket,{mint,sessionId}){
 if(typeof ticket!=='string'||ticket.length>2048)throw Error('PERMIT_INVALID');
 const parts=ticket.split('.');
 if(parts.length!==2||parts.some(s=>!s||!/^[A-Za-z0-9_-]+$/.test(s)))throw Error('PERMIT_INVALID');
 const [payload,sig]=parts,expected=crypto.createHmac('sha256',key()).update(payload).digest(),actual=Buffer.from(sig,'base64url');
 if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw Error('PERMIT_SIGNATURE');
 const d=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')),now=Date.now();
 if(!d||d.version!==1||d.purpose!=='research'||!MINT.test(d.mint||'')||!SESSION.test(d.sessionId||'')||!SESSION.test(d.nonce||'')||!Number.isSafeInteger(d.issuedAt)||!Number.isSafeInteger(d.expiresAt)||d.expiresAt-d.issuedAt!==VALIDITY_MS||d.issuedAt>now+CLOCK_SKEW_MS||d.expiresAt<=now||d.mint!==mint||(sessionId!==undefined&&d.sessionId!==sessionId)||d.clientBinding!==binding(req))throw Error('PERMIT_BINDING');
 return d;
}
module.exports={issue,verify,VALIDITY_MS,CLOCK_SKEW_MS};

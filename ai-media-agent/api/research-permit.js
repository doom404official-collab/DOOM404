"use strict";
const crypto=require('node:crypto');
const {gate,MINT}=require('../lib/research-security');
const {admit}=require('../lib/durable-admission');
const permits=require('../lib/research-permit');
module.exports=async(req,res)=>{
 if(!gate(req,res))return;
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.mint!=='string'||!MINT.test(body.mint)||Object.keys(body).some(k=>!['mint','researchPermit'].includes(k)))return res.status(400).json({error:'INVALID_PERMIT_REQUEST'});
 let previous;
 if(body.researchPermit!==undefined){try{previous=permits.verify(req,body.researchPermit,{mint:body.mint});}catch{return res.status(403).json({error:'RESEARCH_PERMIT_REQUIRED'});}}
 if(!await admit(req,res,'permit',crypto.randomUUID()))return;
 try{return res.status(200).json({mint:body.mint,...permits.issue(req,body.mint,previous)});}catch{return res.status(503).json({error:'RESEARCH_PERMIT_UNAVAILABLE'});}
};

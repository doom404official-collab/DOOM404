"use strict";
const {gate,sign,MINT,SESSION}=require('../lib/research-security');
const {earlyLaunch}=require("../lib/early-launch");
const {build}=require('../universal');
const {synthesize}=require('../lib/editorial-synthesis');
const {review}=require('../lib/editorial-validation');
const {buildEvidence}=require('../lib/editorial-evidence');
const {admit}=require('../lib/durable-admission');
const permits=require('../lib/research-permit');
async function collect(name,mint){
 const handler=require('./'+name);let value,status=200;
 const response={setHeader(){},status(n){status=n;return this},json(d){value=d;return this},end(){},send(d){value=d;return this}};
 await handler({method:'GET',query:{mint},headers:{}},response);
 if(status!==200||value?.mint!==mint)throw Error('EVIDENCE_UNAVAILABLE');return value;
}
module.exports=async(req,res)=>{
 if(!gate(req,res))return;
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))return res.status(400).json({error:'INVALID_RESEARCH_REQUEST'});
 const {mint,sessionId,researchPermit,...extra}=req.body;
 if(typeof mint!=='string'||typeof sessionId!=='string'||!MINT.test(mint||'')||!SESSION.test(sessionId||'')||Object.keys(extra).length)return res.status(400).json({error:'INVALID_RESEARCH_REQUEST'});
 let permit;try{permit=permits.verify(req,researchPermit,{mint,sessionId});}catch{return res.status(403).json({error:'RESEARCH_PERMIT_REQUIRED'});}
 // Consume the signed session, not the replaceable permit nonce.
 if(!await admit(req,res,'research',sessionId,permit))return;
 try{permits.verify(req,researchPermit,{mint,sessionId});}catch{return res.status(403).json({error:'RESEARCH_PERMIT_REQUIRED'});}
 const started=Date.now(),stages=[];
 try{
 const h=await collect('owners',mint);
 const results=await Promise.allSettled(['relationships','token-context','project-credibility','creator-intelligence'].map(n=>collect(n,mint)));
 const [relationships,contextResult,credibility,creator]=results.map(x=>x.status==='fulfilled'?x.value:null);
 const context=contextResult||{mint};context.credibility=credibility;context.creatorIntelligence=creator;
 if(!context.market){const poolPrice=await require("../lib/verified-pool-price").verifiedPoolPrice({mint,holders:h});context.poolPriceDiagnostics=poolPrice.status;if(poolPrice.market){context.market=poolPrice.market;context.exitRisk=await require("../lib/exit-quotes").exitQuotes({mint,priceUsd:context.market.priceUsd,decimals:h.supply.decimals});}}
 context.tokenProfile=await require("../lib/token-profile").profile(mint);
 context.earlyLaunch=earlyLaunch({mint,creator,relationships,market:context.market});
 const report=build(mint,h,relationships,context);report.sessionId=sessionId;
 let status='DETERMINISTIC_FALLBACK',reason='CONFIG_MISSING';
 const key=process.env.OPENAI_EDITORIAL_API_KEY,model=process.env.OPENAI_EDITORIAL_MODEL;
 const evidence=buildEvidence(report);stages.push({stage:'evidence',bytes:Buffer.byteLength(JSON.stringify(evidence)),facts:evidence.facts.length,failedModules:results.map((x,i)=>x.status==='rejected'?i:null).filter(x=>x!==null)});
 if(key&&model){try{let correction=null;for(let attempt=1;attempt<=2;attempt++){
 const t=Date.now(),result=await synthesize(report,{key,model,correction});stages.push({stage:'generation',attempt,ms:Date.now()-t,usage:result.usage});
 const rt=Date.now(),audit=await review(result.draft,result.evidence,{key,model});stages.push({stage:'review',attempt,ms:Date.now()-rt,approved:audit.approved,usage:audit.usage,issueCount:audit.issues.length,issues:audit.issues.slice(0,8).map(x=>String(x).replace(/sk-[A-Za-z0-9_-]+/g,"[redacted]").slice(0,600))});
 if(audit.approved){report.headline=result.draft.headline;report.scenes=result.draft.scenes.map(s=>({label:s.role.toUpperCase().replaceAll('_',' '),value:'EVIDENCE-LED REPORT',note:'AI-REVIEWED EDITORIAL',caption:s.caption,evidenceIds:s.evidenceIds,evidenceCards:s.evidenceIds.map(id=>result.evidence.facts.find(f=>f.id===id)).filter(Boolean)}));report.script=report.scenes.map(s=>s.caption).join(' ');status='AI_REVIEW_PASSED';reason=null;break;}
 reason='REVIEW_REJECTED';correction={draft:result.draft,issues:audit.issues};
 }}catch(e){reason=e?.name==='TimeoutError'?'UPSTREAM_TIMEOUT':/^(EVIDENCE_TOO_LARGE|EDITORIAL_PROVIDER_ERROR_\d{3}|EDITORIAL_INCOMPLETE|EDITORIAL_SCHEMA_OR_REFERENCE_INVALID|REVIEW_PROVIDER_ERROR|REVIEW_INCOMPLETE)$/.test(e?.message||'')?e.message:'EDITORIAL_FAILED';stages.push({stage:'failure',reason});}}
 report.editorialStatus=status;
 const narrationTicket=key?sign({purpose:'narration',mint,sessionId,sentences:report.scenes.map(s=>s.caption)}):null;
 return res.status(200).json({mint,sessionId,status,report,narrationTicket,diagnostics:{reason,elapsedMs:Date.now()-started,stages,quotaScope:'DURABLE_SUPABASE'}});
 }catch{return res.status(503).json({mint,sessionId,error:'RESEARCH_EVIDENCE_UNAVAILABLE'});}
};


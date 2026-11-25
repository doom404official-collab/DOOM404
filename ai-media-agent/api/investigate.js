"use strict";
const {gate,sign,MINT,SESSION}=require('../lib/research-security');
const {earlyLaunch}=require("../lib/early-launch");
const {build}=require('../universal');
const {synthesize}=require('../lib/editorial-synthesis');
const {review}=require('../lib/editorial-validation');
const {buildEvidence}=require('../lib/editorial-evidence');
const inFlight=new Set();
async function collect(name,mint){
 const handler=require('./'+name);let value,status=200;
 const response={setHeader(){},status(n){status=n;return this},json(d){value=d;return this},end(){},send(d){value=d;return this}};
 await handler({method:'GET',query:{mint},headers:{}},response);
 if(status!==200||value?.mint!==mint)throw Error('EVIDENCE_UNAVAILABLE');return value;
}
module.exports=async(req,res)=>{
 if(!gate(req,res))return;
 const {mint,sessionId,...extra}=req.body||{};
 if(!MINT.test(mint||'')||!SESSION.test(sessionId||'')||Object.keys(extra).length)return res.status(400).json({error:'INVALID_RESEARCH_REQUEST'});
 if(inFlight.has(sessionId))return res.status(409).json({error:'RESEARCH_IN_PROGRESS'});
 inFlight.add(sessionId);const started=Date.now(),stages=[];
 try{
 const h=await collect('owners',mint);
 const results=await Promise.allSettled(['relationships','token-context','project-credibility','creator-intelligence'].map(n=>collect(n,mint)));
 const [relationships,contextResult,credibility,creator]=results.map(x=>x.status==='fulfilled'?x.value:null);
 const context=contextResult||{mint};context.credibility=credibility;context.creatorIntelligence=creator;
 context.earlyLaunch=earlyLaunch({mint,creator,relationships,market:context.market});
 const report=build(mint,h,relationships,context);report.sessionId=sessionId;
 let status='DETERMINISTIC_FALLBACK',reason='CONFIG_MISSING';
 const key=process.env.OPENAI_EDITORIAL_API_KEY,model=process.env.OPENAI_EDITORIAL_MODEL;
 const evidence=buildEvidence(report);stages.push({stage:'evidence',bytes:Buffer.byteLength(JSON.stringify(evidence)),facts:evidence.facts.length,failedModules:results.map((x,i)=>x.status==='rejected'?i:null).filter(x=>x!==null)});
 if(key&&model){try{let correction=null;for(let attempt=1;attempt<=2;attempt++){
 const t=Date.now(),result=await synthesize(report,{key,model,correction});stages.push({stage:'generation',attempt,ms:Date.now()-t,usage:result.usage});
 const rt=Date.now(),audit=await review(result.draft,result.evidence,{key,model});stages.push({stage:'review',attempt,ms:Date.now()-rt,approved:audit.approved,usage:audit.usage,issueCount:audit.issues.length});
 if(audit.approved){report.headline=result.draft.headline;report.scenes=result.draft.scenes.map(s=>({label:s.role.toUpperCase().replaceAll('_',' '),value:'EVIDENCE-LED REPORT',note:'AI-REVIEWED EDITORIAL',caption:s.caption,evidenceIds:s.evidenceIds,evidenceCards:s.evidenceIds.map(id=>result.evidence.facts.find(f=>f.id===id)).filter(Boolean)}));report.script=report.scenes.map(s=>s.caption).join(' ');status='AI_REVIEW_PASSED';reason=null;break;}
 reason='REVIEW_REJECTED';correction={draft:result.draft,issues:audit.issues};
 }}catch(e){reason=e?.name==='TimeoutError'?'UPSTREAM_TIMEOUT':'EDITORIAL_FAILED';}}
 report.editorialStatus=status;
 const narrationTicket=key?sign({purpose:'narration',mint,sessionId,sentences:report.scenes.map(s=>s.caption)}):null;
 return res.status(200).json({mint,sessionId,status,report,narrationTicket,diagnostics:{reason,elapsedMs:Date.now()-started,stages,quotaScope:'INSTANCE_ONLY'}});
 }catch{return res.status(503).json({mint,sessionId,error:'RESEARCH_EVIDENCE_UNAVAILABLE'});}finally{inFlight.delete(sessionId);}
};

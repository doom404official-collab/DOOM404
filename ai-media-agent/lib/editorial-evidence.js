const DOMAINS=["market","security","creator","holders","liquidity","integrity","utility","relationships"];
function buildEvidence(report){
 if(!report||typeof report.mint!=="string"||report.eligible!==true)throw Error("Invalid intelligence report");
 const facts=[];const add=(domain,value,provenance)=>{if(value==null)return;facts.push({id:"E"+String(facts.length+1).padStart(3,"0"),domain,provenance,value});};
 const c=report.context||{},e=report.evidenceCategories||{},h=report.evidence?.holders||e.verifiedObservations?.holders,r=report.evidence?.recent||e.verifiedObservations?.recent;
 add("market",c.market,"reported_market_data");
 add("security",c.security,"on_chain_observation");
 add("creator",c.creatorIntelligence,"bounded_on_chain_observation");
 if(h)add("holders",{top20TokenAccountSharePercent:h.top20TokenAccountSharePercent,nonExcludedTop20SharePercent:h.nonExcludedTop20SharePercent,classifiedInfrastructureSharePercent:h.classifiedInfrastructureSharePercent,accounts:h.accounts},"bounded_on_chain_observation");
 add("liquidity",c.exitRisk,"read_only_quote_not_execution");
 add("integrity",r?.manipulationIndicators,"bounded_indicators_not_proof");
 if(r)add("relationships",{scope:r.scope,directTransfers:r.directTransfers,sharedFundingObservations:r.sharedFundingObservations,relationshipGraph:r.relationshipGraph},"bounded_observations_not_common_control");
 add("utility",report.credibility,"project_evidence_with_source_specific_limitations");
 add("utility",e.reportedProjectClaims,"reported_claims_not_verified");
 return {version:1,mint:report.mint,identity:report.identity||{},observedAt:report.observedAt||null,coverage:DOMAINS.map(domain=>({domain,available:facts.some(f=>f.domain===domain)})),facts,unresolved:report.unresolved||[],references:report.references||[]};
}
module.exports={buildEvidence};

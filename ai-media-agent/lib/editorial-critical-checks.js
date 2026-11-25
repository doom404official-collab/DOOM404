"use strict";
function criticalChecks(draft,evidence){
 const text=JSON.stringify(draft),source=JSON.stringify(evidence),issues=[];
 for(const address of text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)||[])if(!source.includes(address))issues.push('Uncited blockchain identity');
 const creators=(evidence.facts||[]).filter(f=>f.domain==='creator').map(f=>f.value);
 const sales=creators.flatMap(c=>(c.history?.tokenDisposals||[]).flatMap(x=>x.sales||[]));
 if(/\bcreator(?: wallet)? (?:sold|dumped)\b/i.test(text)&&!sales.length)issues.push('Creator market-sale attribution lacks classified sale evidence');
 if(/\b(?:confirmed|proven|detected) wash trading\b|\bwash trading (?:confirmed|proven|detected)\b/i.test(text))issues.push('Unsupported definitive manipulation classification');
 return [...new Set(issues)];
}
module.exports={criticalChecks};

"use strict";
// Narrow evidence-conditioned wording corrections. The factual reviewer still
// reviews the resulting complete script and can reject every correction.
function qualify(draft,evidence){
 const facts=evidence.facts||[],holders=facts.find(f=>f.domain==='holders')?.value;
 const rel=facts.find(f=>f.domain==='relationships')?.value;
 const ownerSample=new Set(rel?.scope?.ownersSelected||[]);
 const sampledPoolOwner=(holders?.accounts||[]).some(a=>a.classification?.includes('POOL_VAULT')&&ownerSample.has(a.tokenOwner));
 const assumption=facts.filter(f=>f.domain==='liquidity').some(f=>JSON.stringify(f.value).includes('assumed near one dollar'));
 return {...draft,scenes:draft.scenes.map(s=>{let caption=s.caption;if(assumption)caption=caption.replace(/\bWith USDC near (?:one|a) dollar\b/g,'Assuming one USDC was worth about one dollar');if(sampledPoolOwner)caption=caption.replace(/\bthe vault and (one|two|three|four) unclassified owners\b/g,'the pool owner address and $1 unclassified owners');return {...s,caption}})};
}
module.exports={qualify};

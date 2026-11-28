import {scoreHolderIntelligence} from "./glitchAttributeEnginesV11.mjs";
/** Read-only UI adapter. Never presents incomplete network evidence as a final score. */
export function scoreHolderIntelligenceForDisplay({top20SharePct,historyComplete=false,...rest}={}){
 const r=scoreHolderIntelligence({top20SharePct,historyComplete:false});
 const components=r.components.map(c=>({...c,score:c.points,label:c.id.replaceAll("_"," ")}));
 return {...r,components,earned:components.reduce((s,c)=>s+(c.score??0),0),possible:components.filter(c=>c.score!==null).reduce((s,c)=>s+c.max,0),
 score:null,provisionalScore:null,historyComplete:false,
 methodology:"GLITCH v1.1: Top-20 concentration is observed; network, creator exposure and independence require verified coverage."};
}

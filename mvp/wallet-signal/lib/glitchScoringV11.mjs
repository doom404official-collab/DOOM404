export const version = "1.1";
export const attributes = [
 {id:"token_security",name:"Token Security",weight:25,components:{transfer_fee_schedule:25,fee_configuration_authority:25,mint_authority:25,freeze_authority:25}},
 {id:"holder_intelligence",name:"Holder Intelligence",weight:25,components:{top20_holder_concentration:35,connected_wallet_network:35,creator_team_exposure:20,holder_breadth_independence:10}},
 {id:"creator_intelligence",name:"Creator Intelligence",weight:25,components:{creator_identification:20,creator_holdings:20,creator_selling:30,previous_launches:30}},
 {id:"liquidity_quality_safety",name:"Liquidity Quality & Safety",weight:25,components:{available_liquidity:25,liquidity_market_cap_ratio:20,lp_security:25,liquidity_concentration:10,trading_impact:10,liquidity_stability:10}}
];
for(const attribute of attributes){Object.freeze(attribute.components);Object.freeze(attribute);}
Object.freeze(attributes);
// The public contract is a keyed map, not an array of duplicate assessments.
// Preserve legacy scalar callers, but never relabel an explicit foreign identity
// or methodology version. Provenance/freshness remain producer-adapter checks.
function readAssessment(results,id){
 if(!results||typeof results!=="object"||Array.isArray(results)||![Object.prototype,null].includes(Object.getPrototypeOf(results)))return {};
 const entry=Object.getOwnPropertyDescriptor(results,id);
 if(!entry||!Object.hasOwn(entry,"value"))return {};
 const row=entry.value;
 if(!row||typeof row!=="object"||Array.isArray(row)||![Object.prototype,null].includes(Object.getPrototypeOf(row)))return {};
 const pending=[row],seen=new WeakSet();
 while(pending.length){
  const value=pending.pop();if(seen.has(value))continue;seen.add(value);
  const descriptors=Object.values(Object.getOwnPropertyDescriptors(value));
  if(descriptors.some(d=>!Object.hasOwn(d,"value")))return {};
  for(const d of descriptors)if(d.value!==null&&typeof d.value==="object")pending.push(d.value);
 }
 if((Object.hasOwn(row,"attribute")&&row.attribute!==id)||(Object.hasOwn(row,"version")&&row.version!==version))return {};
 try{return structuredClone(row);}catch{return {};}
}
export function consolidate(results={}) {
 const checks=attributes.map(a=>({...readAssessment(results,a.id),id:a.id,weight:a.weight}));
 const complete=checks.every(c=>["complete","calibrated","score"].every(k=>Object.hasOwn(c,k))&&c.complete===true&&c.calibrated===true&&typeof c.score==="number"&&Number.isFinite(c.score)&&c.score>=0&&c.score<=100);
 return {version,checks,score:complete?Math.round(checks.reduce((s,c)=>s+c.weight*c.score/100,0)*100)/100:null,status:complete?"complete":"incomplete"};
}

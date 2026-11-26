import {attributes,consolidate} from './glitchScoringV11.mjs';
// Bounds over the unchanged approved weights. Missing criteria add no earned
// points; their full weight stays in the upper bound. Never a complete rating.
export function assessmentBounds(results){
 const checks=consolidate(results).checks;
 let low=0,high=0,coverage=0;
 for(const a of attributes){
  const r=checks.find(c=>c.id===a.id),parts=r?.components;
  const valid=Array.isArray(parts)&&parts.length===Object.keys(a.components).length&&Object.entries(a.components).every(([id,max])=>parts.filter(p=>p.id===id&&(p.max===max||a.id==='token_security'&&['transfer_fee_schedule','fee_configuration_authority'].includes(id)&&p.max===0&&p.reason==='not_applicable')&&(p.points===null||typeof p.points==='number'&&Number.isFinite(p.points)&&p.points>=0&&p.points<=p.max)).length===1);
  if(!valid){high+=a.weight;continue;}
  const max=parts.reduce((n,p)=>n+p.max,0);
  if(!max){high+=a.weight;continue;}
  const earned=parts.reduce((n,p)=>n+(p.points??0),0),unknown=parts.reduce((n,p)=>n+(p.points===null?p.max:0),0);
  low+=a.weight*earned/max;high+=a.weight*(earned+unknown)/max;coverage+=a.weight*(max-unknown)/max;
 }
 const round=x=>Math.round(x*100)/100;
 return {lower:round(low),upper:round(high),coveragePct:round(coverage),status:'limited_assessment',calibrated:false};
}

// Frozen differential oracle from assessment 58195222483621de5e2eee4c6be78704fe9c67b2.
// Only valid boolean inputs are compared; malformed flags intentionally differ.
import {attributes,version} from "../../../lib/glitchScoringV11.mjs";
const round=n=>Math.round(n*100)/100;
const valid=(n,max=100)=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=max;
const linear=(x,full,zero,max)=>round(max*Math.max(0,Math.min(1,(x-zero)/(full-zero))));
const component=(id,max,points,reason)=>({id,max,points:max===0?null:valid(points,max)?round(points):null,...(reason?{reason}:{})});
function result(id,parts,{calibrated=false}={}){
 const eligible=parts.filter(p=>p.max>0);
 const complete=eligible.length>0&&eligible.every(p=>p.points!==null);
 const assessed=eligible.reduce((s,p)=>s+(p.points!==null?p.max:0),0);
 const maximum=eligible.reduce((s,p)=>s+p.max,0);
 return {version,attribute:id,components:parts,score:complete?round(eligible.reduce((s,p)=>s+p.points,0)*100/maximum):null,complete,calibrated,coveragePct:maximum?round(assessed*100/maximum):0};
}
export function scoreTokenSecurity({tokenProgram,authoritiesParsed=false,mintAuthority,freezeAuthority,feeExtensionVerified=false,feeApplicable,feePercent,feeConfigAuthorityReported=false,feeConfigAuthority}={}){
 const feeNA=tokenProgram==="spl-token"||(feeExtensionVerified&&feeApplicable===false);
 const schedule=feeNA?null:valid(feePercent)?feePercent===0?25:feePercent<=1?20:feePercent<=3?12:feePercent<=5?5:0:null;
 const parts=[
  component("transfer_fee_schedule",feeNA?0:25,schedule,feeNA?"not_applicable":undefined),
  component("fee_configuration_authority",feeNA?0:25,feeNA?null:feeConfigAuthorityReported?(feeConfigAuthority?0:25):null,feeNA?"not_applicable":undefined),
  component("mint_authority",25,authoritiesParsed&&mintAuthority!==undefined?(mintAuthority?0:25):null),
  component("freeze_authority",25,authoritiesParsed&&freezeAuthority!==undefined?(freezeAuthority?0:25):null)
 ];
 return result("token_security",parts);
}

import {adaptDashboardEvidence} from "./glitchDashboardEvidenceV11.mjs";
/** Compatibility for existing UI; v1.1 security taxonomy only. No account concentration. */
export function assessTokenControls({result,extensions}={}){
 const assessment=adaptDashboardEvidence({result,extensions}).scores.token_security;
 const checks=assessment.components.map(c=>({id:c.id,weight:c.max,points:c.points,
  status:c.reason==="not_applicable"?"not_applicable":c.points===null?"unknown":"observed",
  source:c.id.includes("fee")?"Token-2022 parsed RPC":"Solana RPC"}));
 return {...assessment,checks,observedEvidencePct:assessment.coveragePct,
  provisionalScore:assessment.score,score:null,
  label:"GLITCH v1.1 Token Security — rating withheld pending calibration",
  notSafetyScore:true};
}

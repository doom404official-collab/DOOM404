import {mintAuthorityEvidence} from "./mintAuthorityEvidence.mjs";
import {scoreTokenSecurity} from "./glitchAttributeEnginesV11.mjs";
/** Compatibility for existing UI; v1.1 security taxonomy only. No account concentration. */
export function assessTokenControls({result,extensions}={}){
 const fee=extensions?.transferFee;
 const authorities=mintAuthorityEvidence(result,{parsed:!!result&&result.authorityDetailsStatus!=="not_parsed"});
 const authoritiesParsed=authorities.authorityDetailsStatus==="available";
 const feeExtensionVerified=extensions?.verified===true;
 const feeApplicable=fee?.status==="observed"?true:feeExtensionVerified&&Array.isArray(extensions?.extensions)&&!extensions.extensions.some(x=>x.type==="transferFeeConfig")?false:undefined;
 const effective=fee?.newerFee?.percentage;
 const assessment=scoreTokenSecurity({
  tokenProgram:result?.tokenProgram,authoritiesParsed,
  mintAuthority:authorities.mintAuthority,freezeAuthority:authorities.freezeAuthority,
  feeExtensionVerified,feeApplicable,
  feePercent:typeof effective==="number"?effective:undefined,
  feeConfigAuthorityReported:fee?.configAuthorityReported===true,
  feeConfigAuthority:fee?.configAuthority
 });
 const checks=assessment.components.map(c=>({id:c.id,weight:c.max,points:c.points,
  status:c.reason==="not_applicable"?"not_applicable":c.points===null?"unknown":"observed",
  source:c.id.includes("fee")?"Token-2022 parsed RPC":"Solana RPC"}));
 return {...assessment,checks,observedEvidencePct:assessment.coveragePct,
  provisionalScore:assessment.score,score:null,
  label:"GLITCH v1.1 Token Security — rating withheld pending calibration",
  notSafetyScore:true};
}

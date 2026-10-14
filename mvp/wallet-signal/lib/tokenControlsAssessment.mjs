/**
 * Token-controls-only assessment. Creator evidence is deliberately excluded.
 * This is not a token safety, scam-probability, or investment-quality score.
 */
export function assessTokenControls({result,extensions,concentration}={}){
 const checks=[];
 const authoritiesKnown=Boolean(result&&result.authorityDetailsStatus!=="not_parsed"&&
  Object.hasOwn(result,"mintAuthority")&&Object.hasOwn(result,"freezeAuthority"));
 if(authoritiesKnown)checks.push({id:"mint_freeze",weight:2,points:result.mintAuthority||result.freezeAuthority?0:2,
  status:result.mintAuthority||result.freezeAuthority?"centralized_controls":"no_active_mint_freeze_controls",source:"Solana RPC"});
 else checks.push({id:"mint_freeze",weight:2,points:null,status:"unknown",source:"Solana RPC"});
 const isStandard=result?.tokenProgram==="spl-token";
 if(isStandard)checks.push({id:"token2022_fee",weight:1,points:null,status:"not_applicable",source:"SPL Token"});
 else if(extensions?.verified===true&&extensions?.transferFee?.status==="observed"){
  const fee=extensions.transferFee;
  checks.push({id:"token2022_fee",weight:1,points:fee.configAuthorityReported===true?(fee.configAuthority?0:1):null,
   status:fee.configAuthorityReported===true?(fee.configAuthority?"fee_authority_active":"fee_authority_revoked"):"unknown",
   source:"Token-2022 parsed RPC"});
 }else checks.push({id:"token2022_fee",weight:1,points:null,status:"unknown",source:"Token-2022 parsed RPC"});
 const share=Number(concentration?.largestAccountSharePct);
 const validShare=concentration?.largestAccountSharePct!=null&&Number.isFinite(share)&&share>=0&&share<=100;
 checks.push({id:"account_concentration",weight:1,points:null,status:validShare?"observed_unclassified":"unknown",
  observedSharePct:validShare?share:null,source:"Solana RPC"});
 const eligible=checks.filter(x=>x.status!=="not_applicable");
 const assessed=eligible.filter(x=>x.points!==null);
 const totalWeight=eligible.reduce((sum,x)=>sum+x.weight,0);
 const scoredWeight=assessed.reduce((sum,x)=>sum+x.weight,0);
 const observedWeight=eligible.filter(x=>x.status!=="unknown").reduce((sum,x)=>sum+x.weight,0);
 // Only mint/freeze and applicable fee authority are scored; never convert
 // concentration without owner classification into a safety number.
 const provisionalScore=assessed.length>=1&&scoredWeight>=2?
  Math.round(100*assessed.reduce((sum,x)=>sum+x.points,0)/scoredWeight):null;
 return {version:"token_controls_v1",score:null,provisionalScore,label:provisionalScore===null?"Not enough evidence":"Observed permission controls only — numerical rating withheld pending calibration",
  scoredWeight,eligibleWeight:totalWeight,coveragePct:totalWeight?Math.round(100*scoredWeight/totalWeight):0,
  observedEvidencePct:totalWeight?Math.round(100*observedWeight/totalWeight):0,
  checks,creatorIndependent:true,notSafetyScore:true};
}

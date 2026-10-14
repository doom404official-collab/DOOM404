/** Decision-support summary, not a buy/sell recommendation or scam probability.
 * Coverage and observed concern are separate dimensions.
 */
export function buildDecisionSummary({result,extensions,concentration,liquidity,creatorEvidence}={}){
 const findings=[];
 const add=(priority,title,detail,source)=>findings.push({priority,title,detail,source});
 const onchain=["VERIFIED","ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"].includes(creatorEvidence?.status)&&Boolean(creatorEvidence?.creator)&&Boolean(creatorEvidence?.evidence?.length);
 if(onchain)add(65,"Creator wallet identified","Creation instruction evidence matches the reported creator wallet. This does not establish beneficial ownership or legitimacy.","Intelligence Vault");
 const share=Number(concentration?.largestAccountSharePct);
 if(concentration?.largestAccountSharePct!=null&&Number.isFinite(share)&&share>=0&&share<=100)
  add(share>=20?95:60,"Token-account concentration","Largest account holds "+share.toFixed(2)+"% of supply. Pools, custody and beneficial ownership have not been classified.","Solana RPC");
 if(result&&result.authorityDetailsStatus!=="not_parsed"&&Object.hasOwn(result,"mintAuthority")&&Object.hasOwn(result,"freezeAuthority")){
  if(result.mintAuthority||result.freezeAuthority)add(98,"Active token authorities","Mint or freeze authority remains present. This is centralized control exposure, not evidence of misuse; review issuer powers, governance and actual usage.","Solana RPC");
  else add(45,"Mint and freeze controls","Neither mint nor freeze authority was reported in the verified mint state. This does not rule out other controls.","Solana RPC");
 }
 // Non-applicable controls belong in attribute details, not prioritized risk findings.
 if(extensions?.transferFee?.status==="observed")
  add(85,"Transfer-fee controls observed","A Token-2022 fee configuration was observed; effective fees and change authority require review.","Token-2022 RPC");
 if(liquidity?.reportedLiquidityUsd!=null)
  add(70,"Liquidity depth not established","Provider reports $"+Math.round(liquidity.reportedLiquidityUsd).toLocaleString("en-US")+" in liquidity. Reserve control and executable sell depth remain unverified.","Liquidity provider");
 findings.sort((a,b)=>b.priority-a.priority);
 const coverage=[
  onchain,
  concentration?.largestAccountSharePct!=null,
  Boolean(result&&result.authorityDetailsStatus!=="not_parsed"&&Object.hasOwn(result,"mintAuthority")&&Object.hasOwn(result,"freezeAuthority")),
  result?.tokenProgram==="spl-token"||extensions?.verified===true,
  liquidity?.reportedLiquidityUsd!=null
 ].filter(Boolean).length;
 const concentrationFlag=concentration?.largestAccountSharePct!=null&&Number.isFinite(share)&&share>=20;
 const centralizedControls=Boolean(result?.mintAuthority||result?.freezeAuthority);
 return {
  status:concentrationFlag?"CONCENTRATION_REVIEW":centralizedControls?"CENTRALIZED_CONTROLS_OBSERVED":coverage>=3?"CAUTION_PARTIAL_EVIDENCE":"INSUFFICIENT_EVIDENCE",
  title:concentrationFlag?"Concentration signal requires investigation":centralizedControls?"Centralized token controls detected":coverage>=3?"Caution — further checks needed":"Insufficient evidence for a reliable conclusion",
  coverageCount:coverage,coverageTotal:5,
  explanation:concentrationFlag?"A large token account was observed, but its beneficial owner and role are not established. Active issuer permissions, if present, are a separate centralization exposure.":centralizedControls?"Mint or freeze permissions are active. These capabilities may be intentional issuer controls and do not by themselves demonstrate malicious behavior.":
   coverage>=3?"Some technical controls can be assessed, but liquidity resilience, ownership and creator behaviour remain incompletely verified.":
   "Available observations are too limited for a meaningful consolidated risk conclusion.",
  findings:findings.slice(0,3),isInvestmentAdvice:false
 };
}

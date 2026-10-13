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
 if(result?.authorityDetailsStatus!=="not_parsed"&&result){
  if(result.mintAuthority||result.freezeAuthority)add(98,"Active token authorities","Mint or freeze authority remains present; authority powers and usage require review.","Solana RPC");
  else add(45,"Mint and freeze controls","Neither mint nor freeze authority was reported in the verified mint state. This does not rule out other controls.","Solana RPC");
 }
 if(result?.tokenProgram==="spl-token")
  add(40,"Transfer-fee extension not applicable","Standard SPL Token mints do not support Token-2022 transfer-fee extensions. Other application-level charges are not assessed.","Solana mint owner");
 else if(extensions?.transferFee?.status==="observed")
  add(85,"Transfer-fee controls observed","A Token-2022 fee configuration was observed; effective fees and change authority require review.","Token-2022 RPC");
 if(liquidity?.reportedLiquidityUsd!=null)
  add(70,"Liquidity depth not established","Provider reports $"+Math.round(liquidity.reportedLiquidityUsd).toLocaleString("en-US")+" in liquidity. Reserve control and executable sell depth remain unverified.","Liquidity provider");
 findings.sort((a,b)=>b.priority-a.priority);
 const coverage=[
  onchain,
  concentration?.largestAccountSharePct!=null,
  result?.authorityDetailsStatus!=="not_parsed"&&Boolean(result),
  result?.tokenProgram==="spl-token"||extensions?.verified===true,
  liquidity?.reportedLiquidityUsd!=null
 ].filter(Boolean).length;
 const highConcern=Boolean(result?.mintAuthority||result?.freezeAuthority)||
  (concentration?.largestAccountSharePct!=null&&share>=20);
 return {
  status:highConcern?"ELEVATED_OBSERVED_CONCERN":coverage>=3?"CAUTION_PARTIAL_EVIDENCE":"INSUFFICIENT_EVIDENCE",
  title:highConcern?"Elevated concern in observed controls":coverage>=3?"Caution — further checks needed":"Insufficient evidence for a reliable conclusion",
  coverageCount:coverage,coverageTotal:5,
  explanation:highConcern?"One or more observed controls or concentration indicators warrant investigation. This is not proof of misuse.":
   coverage>=3?"Some technical controls can be assessed, but liquidity resilience, ownership and creator behaviour remain incompletely verified.":
   "Available observations are too limited for a meaningful consolidated risk conclusion.",
  findings:findings.slice(0,3),isInvestmentAdvice:false
 };
}

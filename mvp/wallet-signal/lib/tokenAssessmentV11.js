import {scoreCreatorIntelligence,scoreLiquidityQuality} from "./glitchAttributeEnginesV11.mjs";
import {consolidate} from "./glitchScoringV11.mjs";
/** GLITCH v1.1 evidence summary. Never emits legacy provisional permission scores. */
export function assessTokenEvidence({result,extensions,concentration,liquidity,creatorEvidence}={}){
 const creatorVerified=creatorEvidence?.status==="VERIFIED"&&!!creatorEvidence?.creator;
 const creator=scoreCreatorIntelligence({creatorVerified});
 const liquidityScore=scoreLiquidityQuality({});
 const rows=[
  {id:"permissions",label:"Token Security",assessment:result?.mintAuthority||result?.freezeAuthority?"Active authority observed":"Permission controls require review",coverage:result?.authorityDetailsStatus==="not_parsed"?"missing":result&&Object.hasOwn(result,"mintAuthority")&&Object.hasOwn(result,"freezeAuthority")?"partial":"missing",source:"Solana RPC",explanation:"Mint and freeze authorities are evidence only; Token-2022 extensions may require additional checks.",nextStep:"Verify parsed mint authorities and Token-2022 controls."},
  {id:"concentration",label:"Holder Intelligence",assessment:"Top-20 ownership review",coverage:concentration?.top20TokenAccountSharePct!=null?"partial":"missing",source:"Solana RPC",explanation:"Token accounts do not establish unique beneficial owners; custody, pools and wallet history must be classified.",nextStep:"Verify top-20 owner classification and complete historical transfers."},
  {id:"creator",label:"Creator Intelligence",assessment:creatorVerified?"Launch creator independently verified":"Creator attribution incomplete",coverage:creatorVerified?"verified":"missing",source:"Creator Intelligence",explanation:"Creator attribution alone does not establish previous launch behavior or verified sales.",nextStep:"Verify holdings, sales and historical launches."},
  {id:"liquidity",label:"Liquidity Quality & Safety",assessment:"Liquidity resilience unverified",coverage:liquidity?.reportedLiquidityUsd!=null?"partial":"missing",source:"DexScreener",explanation:"Reported liquidity is an estimate, not verified reserves, LP security or executable depth.",nextStep:"Validate reserves, LP controls and sell impact."}
 ];
 const attributes=rows.map(row=>({...row,score:null,verdict:row.coverage==="missing"?"insufficient_evidence":"review_required",verdictLabel:row.coverage==="missing"?"Insufficient evidence":"Further review required"}));
 const verifiedAttributes=attributes.filter(x=>x.coverage==="verified").length;
 const partialAttributes=attributes.filter(x=>x.coverage==="partial").length;
 const missingAttributes=attributes.length-verifiedAttributes-partialAttributes;
 const actionableFindings=attributes.filter(x=>x.coverage!=="missing").slice(0,3).map(x=>({...x,title:x.assessment,evidence:x.explanation,severity:"information"}));
 return {version:"1.1",attributes,actionableFindings,assessedAttributes:verifiedAttributes+partialAttributes,totalAttributes:4,verifiedAttributes,partialAttributes,missingAttributes,verifiedCoveragePct:Math.round(verifiedAttributes*25),evidenceCoveragePct:Math.round((verifiedAttributes+partialAttributes)*25),consolidatedScore:consolidate({creator_intelligence:creator,liquidity_quality_safety:liquidityScore}).score,consolidatedStatus:"withheld_incomplete_evidence"};
}

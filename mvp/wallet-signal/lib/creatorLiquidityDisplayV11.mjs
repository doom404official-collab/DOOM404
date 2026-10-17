import {scoreCreatorIntelligence,scoreLiquidityQuality} from "./glitchAttributeEnginesV11.mjs";
import {consolidate} from "./glitchScoringV11.mjs";
/** Evidence-only adapter. Unverified provider estimates cannot satisfy scoring gates. */
export function assessCreatorAndLiquidityV11({creatorEvidence,liquidity}={}){
 const creatorVerified=creatorEvidence?.status==="VERIFIED"&&typeof creatorEvidence.creator==="string"&&creatorEvidence.creator.length>0;
 const creator=scoreCreatorIntelligence({creatorVerified});
 const liquidityAssessment=scoreLiquidityQuality({});
 const consolidated=consolidate({creator_intelligence:creator,liquidity_quality_safety:liquidityAssessment});
 return {creator,liquidity:liquidityAssessment,consolidated,
  creatorEvidenceStatus:creatorVerified?"verified_attribution_only":"unverified",
  liquidityEvidenceStatus:liquidity?.reportedLiquidityUsd!=null?"provider_reported_only":"unavailable",
  note:"GLITCH v1.1: creator history and executable liquidity evidence are required before numerical scores."};
}

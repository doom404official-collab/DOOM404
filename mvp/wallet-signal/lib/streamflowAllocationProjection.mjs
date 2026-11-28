/** Client-safe projection of a trusted backend decoder receipt. This is not an
 * independent blockchain verifier; untrusted request input must never be promoted
 * to this schema. A fresh exact balance binding prevents saved/stale observations
 * from relabelling a changed allocation. */
export function projectStreamflowAllocationControl({proof,mint,tokenAccountAddress,currentBalanceRaw,observedAt,maxAgeMs=300000}={}){
 try{
  const p=proof;if(p?.schema!=='verified-streamflow-allocation-v1'||p.protocol!=='streamflow'||p.mint!==mint||p.escrowTokens!==tokenAccountAddress||p.grossRaw!==currentBalanceRaw||p.basis!=='official_v4_metadata_owner_escrow_pda_mint_and_token_authority_binding')return null;
  if(!Number.isSafeInteger(p.evidenceSlot)||p.evidenceSlot<=0||!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(p.supportingSignature??''))return null;
  const at=Date.parse(observedAt),then=Date.parse(p.observedAt);if(!Number.isFinite(at)||!Number.isFinite(then)||!Number.isFinite(maxAgeMs)||maxAgeMs<0||at<then||at-then>maxAgeMs)return null;
  for(const n of ['grossRaw','scheduledNetRaw','scheduledRemainingRaw','restrictedNetRaw','currentlyWithdrawableNetRaw','unclassifiedSurplusRaw','escrowShortfallRaw'])if(!/^\d+$/.test(p[n]??''))return null;
  if(!/^\d+$/.test(p.cliff??'')||BigInt(Math.floor(at/1000))>=BigInt(p.cliff))return null;
  const gross=BigInt(p.grossRaw),restricted=BigInt(p.restrictedNetRaw),surplus=BigInt(p.unclassifiedSurplusRaw);
  if(!p.scheduleCalculationSupported||p.closed!==false||p.canceledAt!=='0'||p.currentlyWithdrawableNetRaw!=='0'||p.escrowShortfallRaw!=='0'||p.restrictedNetRaw!==p.scheduledRemainingRaw||restricted<=0n||restricted+surplus!==gross)return null;
  for(const n of ['cancelableBySender','cancelableByRecipient','transferableBySender','transferableByRecipient','canTopup','pausable','canUpdateRate'])if(p[n]!==false)return null;
  const upgrade=p.upgradeControl;const verifiedUpgrade=upgrade?.schema==='verified-streamflow-upgrade-control-v1'&&upgrade.program==='strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m'&&upgrade.programUpgradeAuthorityVerified===true&&upgrade.administrativeOverrideBehaviourVerified===false&&upgrade.permanentLockVerified===false;
  return {classification:'vesting_escrow',grossRaw:p.grossRaw,restrictedNetRaw:p.restrictedNetRaw,unclassifiedSurplusRaw:p.unclassifiedSurplusRaw,releaseTime:p.cliff,sender:p.sender,recipient:p.recipient,senderIsRecipient:p.sender===p.recipient,creatorDirectHoldings:false,infrastructureVerified:false,withdrawalConditionsVerified:true,programUpgradeAuthorityVerified:!!verifiedUpgrade,upgradeControl:verifiedUpgrade?upgrade:null,permanentLockVerified:false,feeSurplusTreatmentVerified:false,metadataAddress:p.metadataAddress,supportingSignature:p.supportingSignature,evidenceSlot:p.evidenceSlot,observedAt:p.observedAt,basis:p.basis,limitations:verifiedUpgrade?[...(p.limitations??[]).filter(x=>x!=='Deployed program upgrade authority and administrative override behaviour have not been verified.'),upgrade.programUpgradeable?'The program remains upgradeable under its observed authority; internal administrative behaviour is unassessed.':'No loader upgrade authority was observed; internal administrative behaviour remains unassessed.']:p.limitations};
 }catch{return null;}
}

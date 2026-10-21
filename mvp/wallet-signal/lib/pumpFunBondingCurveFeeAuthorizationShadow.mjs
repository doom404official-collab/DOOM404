/** Conservative Pump.fun bonding-curve fee-role authorization review.
 * Historical configuration must be independently verified at the transaction slot.
 * Unlike Pump AMM sweep authorization, no fee-role inference is made from pool state.
 * This module never creates purchase-settlement or promotion evidence.
 */
export function assessBondingCurveFeeAuthorizationShadow({transactionSlot,globalConfig,creatorFeeAuthority,feePayments=[]}={}){
 const slotValid=Number.isSafeInteger(transactionSlot)&&transactionSlot>=0;
 const globalReady=slotValid&&globalConfig?.verified===true&&globalConfig.slot===transactionSlot;
 const creatorReady=slotValid&&creatorFeeAuthority?.verified===true&&creatorFeeAuthority.slot===transactionSlot;
 const results=feePayments.map(payment=>{
  const recipient=payment?.recipient;
  const kind=payment?.kind;
  const ready=kind==='PROTOCOL_FEE'?globalReady:kind==='CREATOR_FEE'?creatorReady:false;
  const permitted=kind==='PROTOCOL_FEE'?globalConfig?.protocolFeeRecipients:kind==='CREATOR_FEE'?creatorFeeAuthority?.authorizedRecipients:null;
  const matched=ready&&typeof recipient==='string'&&recipient.length>0&&Array.isArray(permitted)&&permitted.includes(recipient);
  return {kind:kind||null,recipient:recipient||null,authorizationVerified:matched,status:!ready?'HISTORICAL_STATE_REQUIRED':matched?'RECIPIENT_MATCHED_HISTORICAL_STATE':'RECIPIENT_NOT_IN_HISTORICAL_STATE'};
 });
 const authorizationVerified=results.length>0&&results.every(x=>x.authorizationVerified);
 return {status:authorizationVerified?'HISTORICAL_FEE_ROLES_CORROBORATED':'FEE_AUTHORIZATION_UNVERIFIED',transactionSlot:slotValid?transactionSlot:null,results,authorizationVerified,eligibleForLivePromotion:false,settlementVerified:false,independentlyVerified:false};
}

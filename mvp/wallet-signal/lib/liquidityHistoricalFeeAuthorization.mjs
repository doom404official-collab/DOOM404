export function assessHistoricalFeeAuthorization({transactionSlot,poolState,globalConfig,feeSweeps=[]}={}){
 if(!Array.isArray(feeSweeps))throw Error("INVALID_FEE_SWEEPS");
 const matched=feeSweeps.filter(s=>s?.poolMatched===true);
 const poolSlotMatched=Number.isSafeInteger(transactionSlot)&&transactionSlot>0&&poolState?.slot===transactionSlot&&poolState?.verified===true;
 const configSlotMatched=Number.isSafeInteger(transactionSlot)&&transactionSlot>0&&globalConfig?.slot===transactionSlot&&globalConfig?.verified===true;
 const results=matched.map(s=>{
  const isCreator=s.operation==="sweep_creator_fee";
  const isProtocol=s.operation==="sweep_protocol_fee";
  const supported=isCreator||isProtocol;
  const validRecipient=typeof s.recipient==="string"&&s.recipient.length>0;
  const evidenceReady=supported&&validRecipient&&(isCreator?poolSlotMatched:configSlotMatched);
  const eligible=isCreator?poolState?.coinCreator===s.recipient:isProtocol&&Array.isArray(globalConfig?.protocolFeeRecipients)&&globalConfig.protocolFeeRecipients.includes(s.recipient);
  const status=!supported?"UNSUPPORTED_FEE_OPERATION":!validRecipient?"RECIPIENT_REQUIRED":!evidenceReady?"HISTORICAL_STATE_REQUIRED":eligible?"RECIPIENT_MATCHED_HISTORICAL_STATE":"RECIPIENT_NOT_IN_HISTORICAL_STATE";
  return {operation:s.operation,recipient:s.recipient,source:isCreator?"pool.coin_creator":isProtocol?"global_config.protocol_fee_recipients":null,historicalStateVerified:evidenceReady,recipientEligible:evidenceReady?Boolean(eligible):null,authorizationVerified:evidenceReady&&eligible===true,status};
 });
 const authorizationVerified=results.length>0&&results.every(r=>r.authorizationVerified);
 return {transactionSlot:Number.isSafeInteger(transactionSlot)?transactionSlot:null,results,authorizationVerified,settlementVerified:false,withdrawalConfirmed:false,limitation:"Slot-matched, independently verified historical state is required; current state is insufficient."};
}

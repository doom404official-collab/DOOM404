export function assessHistoricalFeeAuthorization({transactionSlot,poolState,globalConfig,feeSweeps=[]}={}){
 const matched=feeSweeps.filter(s=>s.poolMatched===true);
 const poolSlotMatched=Number.isSafeInteger(transactionSlot)&&poolState?.slot===transactionSlot&&poolState?.verified===true;
 const configSlotMatched=Number.isSafeInteger(transactionSlot)&&globalConfig?.slot===transactionSlot&&globalConfig?.verified===true;
 const results=matched.map(s=>{
  const isCreator=s.operation==="sweep_creator_fee";
  const evidenceReady=isCreator?poolSlotMatched:configSlotMatched;
  const eligible=isCreator?poolState?.coinCreator===s.recipient:Array.isArray(globalConfig?.protocolFeeRecipients)&&globalConfig.protocolFeeRecipients.includes(s.recipient);
  return {operation:s.operation,recipient:s.recipient,source:isCreator?"pool.coin_creator":"global_config.protocol_fee_recipients",historicalStateVerified:evidenceReady,recipientEligible:evidenceReady?Boolean(eligible):null,authorizationVerified:evidenceReady&&eligible===true,status:!evidenceReady?"HISTORICAL_STATE_REQUIRED":eligible?"RECIPIENT_MATCHED_HISTORICAL_STATE":"RECIPIENT_NOT_IN_HISTORICAL_STATE"};
 });
 const authorizationVerified=results.length>0&&results.every(r=>r.authorizationVerified);
 return {transactionSlot:Number.isSafeInteger(transactionSlot)?transactionSlot:null,results,authorizationVerified,settlementVerified:false,withdrawalConfirmed:false,limitation:"Slot-matched, independently verified historical state is required; current state is insufficient."};
}

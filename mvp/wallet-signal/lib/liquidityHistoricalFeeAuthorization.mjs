import {isDeepStrictEqual} from 'node:util';
export function assessHistoricalFeeAuthorization({transactionSlot,poolState,globalConfig,feeSweeps=[]}={}){
 const matched=Array.isArray(feeSweeps)?feeSweeps.filter(s=>s?.poolMatched===true):[];
 const validSlot=Number.isSafeInteger(transactionSlot)&&transactionSlot>=0;
 const poolSlotMatched=validSlot&&poolState?.slot===transactionSlot&&poolState?.verified===true;
 const configSlotMatched=validSlot&&globalConfig?.slot===transactionSlot&&globalConfig?.verified===true;
 const byIndex=new Map(),conflicts=new Set(),unique=[];
 for(const s of matched){
  const index=s.outerInstructionIndex;
  if(!Number.isSafeInteger(index)||index<0){unique.push(s);continue;}
  if(byIndex.has(index)){if(!isDeepStrictEqual(byIndex.get(index),s))conflicts.add(index);}
  else{byIndex.set(index,s);unique.push(s);}
 }
 const results=unique.map(s=>{
  const isCreator=s.operation==='sweep_creator_fee';
  const supported=isCreator||s.operation==='sweep_protocol_fee';
  const identityReady=Number.isSafeInteger(s.outerInstructionIndex)&&s.outerInstructionIndex>=0&&!conflicts.has(s.outerInstructionIndex);
  const recipientReady=typeof s.recipient==='string'&&s.recipient.length>0;
  const stateReady=isCreator?typeof poolState?.coinCreator==='string'&&poolState.coinCreator.length>0:Array.isArray(globalConfig?.protocolFeeRecipients)&&globalConfig.protocolFeeRecipients.length>0&&globalConfig.protocolFeeRecipients.every(x=>typeof x==='string'&&x.length>0);
  const evidenceReady=supported&&identityReady&&recipientReady&&stateReady&&(isCreator?poolSlotMatched:configSlotMatched);
  const eligible=evidenceReady?(isCreator?poolState.coinCreator===s.recipient:globalConfig.protocolFeeRecipients.includes(s.recipient)):null;
  return {operation:s.operation,recipient:s.recipient??null,outerInstructionIndex:s.outerInstructionIndex??null,source:!supported?null:isCreator?'pool.coin_creator':'global_config.protocol_fee_recipients',historicalStateVerified:evidenceReady,recipientEligible:eligible,authorizationVerified:false,status:!supported?'UNSUPPORTED_FEE_OPERATION':!identityReady?'INSTRUCTION_EVIDENCE_UNAVAILABLE':!evidenceReady?'HISTORICAL_STATE_REQUIRED':eligible?'RECIPIENT_MATCHED_HISTORICAL_STATE':'RECIPIENT_NOT_IN_HISTORICAL_STATE'};
 });
 // Recipient eligibility is only one part of LQ-09. This helper receives no
 // authenticated execution/account-role/SOL-destination proof and cannot authorize.
 return {transactionSlot:validSlot?transactionSlot:null,results,recipientEligibilityVerified:results.length>0&&results.every(r=>r.recipientEligible===true),authorizationVerified:false,settlementVerified:false,withdrawalConfirmed:false,limitation:'Historical recipient eligibility alone does not prove instruction authority, successful settlement or withdrawal; independent execution, account roles and destination evidence remain required.'};
}

/** Evidence-gated creator acquisition ledger. Values are raw token units.
 * Each independently verified movement must have a unique instruction identity.
 * Transfers between attributed wallets are internal and never acquisitions/sales.
 */
const validInstructionIdentity=e=>e&&typeof e.signature==='string'&&
 Number.isSafeInteger(e.instructionIndex)&&e.instructionIndex>=0&&
 (e.innerInstructionIndex==null||(Number.isSafeInteger(e.innerInstructionIndex)&&e.innerInstructionIndex>=0));
const validAmount=amount=>['string','number','bigint'].includes(typeof amount)&&
 (typeof amount!=='number'||Number.isSafeInteger(amount))&&
 /^[0-9]+$/.test(String(amount))&&BigInt(amount)>0n;
const TYPES=new Set(['LAUNCH_DISTRIBUTION','PURCHASE','EXTERNAL_RECEIPT','EXTERNAL_TRANSFER_OUT','VERIFIED_SALE','INTERNAL_TRANSFER']);
export function summarizeCreatorAcquisitionLedger({mint,creator,events=[],historyComplete=false,attributionComplete=false}={}){
 if(typeof mint!=='string'||typeof creator!=='string'||!Array.isArray(events))throw Error('INVALID_CREATOR_LEDGER');
 const accepted=new Map(),rejected=[];
 const rejectionDetail=e=>{
  if(!validInstructionIdentity(e))return 'INVALID_INSTRUCTION_IDENTITY';
  if(!TYPES.has(e.type))return 'UNSUPPORTED_EVENT_TYPE';
  if(e.mint!==mint||e.creator!==creator)return 'ATTRIBUTION_MISMATCH';
  if(e.independentlyVerified!==true)return 'INDEPENDENT_VERIFICATION_MISSING';
  if(e.instructionVerified!==true)return 'INSTRUCTION_VERIFICATION_MISSING';
  if(!Number.isSafeInteger(e.timestamp)||e.timestamp<=0)return 'INVALID_TIMESTAMP';
  if(!validAmount(e.amountRaw))return 'INVALID_AMOUNT';
  if((e.type==='PURCHASE'||e.type==='VERIFIED_SALE')&&e.settlementVerified!==true)return 'SETTLEMENT_VERIFICATION_MISSING';
  if(e.type==='INTERNAL_TRANSFER'&&e.bothWalletsAttributed!==true)return 'INTERNAL_ATTRIBUTION_MISSING';
  return 'INSUFFICIENT_EVIDENCE';
 };
 for(const e of events){
  const id=validInstructionIdentity(e)?
   e.signature+':'+e.instructionIndex+':'+String(e.innerInstructionIndex??'outer'):null;
  if(!id||!e||!TYPES.has(e.type)||e.mint!==mint||e.creator!==creator||
   e.independentlyVerified!==true||e.instructionVerified!==true||
   !Number.isSafeInteger(e.timestamp)||e.timestamp<=0||
   !validAmount(e.amountRaw)||
   (e.type==='VERIFIED_SALE'&&e.settlementVerified!==true)||
   (e.type==='PURCHASE'&&e.settlementVerified!==true)||
   (e.type==='INTERNAL_TRANSFER'&&e.bothWalletsAttributed!==true)){
    rejected.push({id:id||null,reason:'INSUFFICIENT_EVIDENCE',detail:rejectionDetail(e)});continue;
  }
  if(accepted.has(id)){
   if(JSON.stringify(accepted.get(id))!==JSON.stringify(e))rejected.push({id,reason:'CONFLICTING_DUPLICATE'});
   continue;
  }
  accepted.set(id,e);
 }
 const sum=type=>[...accepted.values()].filter(e=>e.type===type).reduce((a,e)=>a+BigInt(e.amountRaw),0n);
 const launch=sum('LAUNCH_DISTRIBUTION'),purchases=sum('PURCHASE'),receipts=sum('EXTERNAL_RECEIPT'),
  transfersOut=sum('EXTERNAL_TRANSFER_OUT'),sales=sum('VERIFIED_SALE');
 const acquired=launch+purchases+receipts;
 const reconciled=acquired-transfersOut-sales;
 const eligible=historyComplete===true&&attributionComplete===true&&rejected.length===0&&reconciled>=0n&&acquired>0n;
 return {status:eligible?'EVIDENCE_READY':'INCOMPLETE',acceptedCount:accepted.size,rejected,
  launchRaw:launch.toString(),purchasedRaw:purchases.toString(),externalReceivedRaw:receipts.toString(),
  externalTransferredOutRaw:transfersOut.toString(),verifiedSoldRaw:sales.toString(),
  totalAcquiredRaw:acquired.toString(),reconciledRemainingRaw:reconciled.toString(),
  historyComplete:historyComplete===true,attributionComplete:attributionComplete===true,
  scoreEligible:eligible,zeroLaunchAllocationVerified:false,
  sellThroughPct:eligible?Number(sales*1000000n/acquired)/10000:null};
}

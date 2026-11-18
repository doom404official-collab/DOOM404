/** Promote transaction observations to ledger events only with independent instruction proof.
 * Unknown transfers and wallet balance changes cannot become verified acquisitions.
 */
export function classifyVerifiedCreatorAcquisition({mint,creator,observation,proof}={}){
 if(!proof||!['string','number','bigint'].includes(typeof proof.amountRaw)||
  (typeof proof.amountRaw==='number'&&!Number.isSafeInteger(proof.amountRaw))||
  !['string','number','bigint'].includes(typeof observation?.amountRaw)||
  (typeof observation.amountRaw==='number'&&!Number.isSafeInteger(observation.amountRaw)))return {status:'UNVERIFIED',event:null};
 if(typeof proof.signature!=='string'||!proof.signature.trim()||!Number.isSafeInteger(proof.instructionIndex)||proof.instructionIndex<0||
  (proof.innerInstructionIndex!=null&&(!Number.isSafeInteger(proof.innerInstructionIndex)||proof.innerInstructionIndex<0))||
  (proof.innerInstructionIndex??null)!==(observation?.innerInstructionIndex??null))return {status:'UNVERIFIED',event:null};
 if(!observation||!proof||observation.mint!==mint||observation.creator!==creator||
  proof.signature!==observation.signature||proof.instructionIndex!==observation.instructionIndex||
  proof.mint!==mint||proof.creator!==creator||proof.independentlyVerified!==true||
  proof.instructionVerified!==true||!/^[0-9]+$/.test(String(proof.amountRaw))||
  String(proof.amountRaw)!==String(observation.amountRaw)||
  !Number.isSafeInteger(proof.timestamp)||proof.timestamp<=0)
 return {status:'UNVERIFIED',event:null};
 const type=proof.type;
 if(type==='LAUNCH_DISTRIBUTION'&&(!Number.isSafeInteger(proof.instructionIndex)||proof.instructionIndex<0||
  !Object.hasOwn(proof,'innerInstructionIndex')||!Object.hasOwn(observation,'innerInstructionIndex')||
  proof.innerInstructionIndex!==observation.innerInstructionIndex||
  (proof.innerInstructionIndex!==null&&(!Number.isSafeInteger(proof.innerInstructionIndex)||proof.innerInstructionIndex<0))))return {status:'UNVERIFIED',event:null};
 if(!['LAUNCH_DISTRIBUTION','PURCHASE','EXTERNAL_RECEIPT','EXTERNAL_TRANSFER_OUT','INTERNAL_TRANSFER'].includes(type)||
  (type==='PURCHASE'&&proof.settlementVerified!==true)||
  (type==='LAUNCH_DISTRIBUTION'&&proof.launchInstructionVerified!==true)||
  (type==='INTERNAL_TRANSFER'&&proof.bothWalletsAttributed!==true))
 return {status:'UNVERIFIED',event:null};
 return {status:'VERIFIED',event:{signature:proof.signature,instructionIndex:proof.instructionIndex,
  innerInstructionIndex:proof.innerInstructionIndex??null,mint,creator,type,
  amountRaw:String(proof.amountRaw),timestamp:proof.timestamp,independentlyVerified:true,
  ...(type==='LAUNCH_DISTRIBUTION'?{launchInstructionVerified:true}:{}),
  instructionVerified:true,settlementVerified:proof.settlementVerified===true,
  bothWalletsAttributed:proof.bothWalletsAttributed===true}};
}

/** Conservative creator initial-allocation evidence.
 * A Pump.fun creation does not imply a creator purchase or token allocation.
 * Only independently verified, mint-bound launch distributions count.
 */
export function assessCreatorInitialAllocation({mint,creator,launchTimestamp,distributions=[],coverageComplete=false}={}){
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint||'')||
 !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator||'')||
 !Number.isSafeInteger(launchTimestamp)||launchTimestamp<=0||!Array.isArray(distributions))throw Error('INVALID_INITIAL_ALLOCATION_INPUT');
 coverageComplete=coverageComplete===true;
 const groups=new Map();let total=0n;const evidence=[];
 for(const x of distributions){
  if(!x||x.mint!==mint||x.recipient!==creator)continue;
  if(x.verifiedLaunchDistribution!==true||x.instructionVerified!==true||
   typeof x.signature!=='string'||!x.signature||
   !Number.isSafeInteger(x.timestamp)||x.timestamp<launchTimestamp||
   !['string','number','bigint'].includes(typeof x.amountRaw)||
   (typeof x.amountRaw==='number'&&!Number.isSafeInteger(x.amountRaw))||
   !/^[0-9]+$/.test(String(x.amountRaw))){coverageComplete=false;continue;}
  const legacy=!Object.hasOwn(x,'instructionIndex')&&!Object.hasOwn(x,'innerInstructionIndex');
  if(!legacy&&(!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(x.signature)||!Number.isSafeInteger(x.instructionIndex)||x.instructionIndex<0||
   !Object.hasOwn(x,'innerInstructionIndex')||(x.innerInstructionIndex!==null&&(!Number.isSafeInteger(x.innerInstructionIndex)||x.innerInstructionIndex<0)))){coverageComplete=false;continue;}
  const record={signature:x.signature,amountRaw:BigInt(x.amountRaw).toString(),timestamp:x.timestamp,
   ...(legacy?{}:{instructionIndex:x.instructionIndex,innerInstructionIndex:x.innerInstructionIndex})};
  if(!groups.has(x.signature))groups.set(x.signature,[]);
  groups.get(x.signature).push({record,legacy});
 }
 for(const signature of [...groups.keys()].sort()){
  const records=groups.get(signature),legacy=records.some(x=>x.legacy);
  // Never invent a mapping from signature-only legacy amounts to instructions.
  if(legacy){coverageComplete=false;if(records.some(x=>!x.legacy))continue;}
  const identities=new Map();
  for(const {record} of records){
   const key=legacy?'legacy':record.instructionIndex+':'+String(record.innerInstructionIndex??'outer');
   if(!identities.has(key))identities.set(key,record);
   else if(JSON.stringify(identities.get(key))!==JSON.stringify(record))identities.set(key,null);
  }
  for(const key of [...identities.keys()].sort()){
   const record=identities.get(key);
   if(!record){coverageComplete=false;continue;}
   total+=BigInt(record.amountRaw);
   evidence.push({signature:record.signature,amountRaw:record.amountRaw,
    ...(legacy?{}:{instructionIndex:record.instructionIndex,innerInstructionIndex:record.innerInstructionIndex})});
  }
 }
 return {status:coverageComplete?'INITIAL_ALLOCATION_EVIDENCE_COMPLETE':'INITIAL_ALLOCATION_INCOMPLETE',
  verifiedObservedRaw:total.toString(),initialAttributableRaw:coverageComplete?total.toString():null,
  coverageComplete:coverageComplete===true,evidence,
  zeroAllocationVerified:coverageComplete===true&&total===0n};
}

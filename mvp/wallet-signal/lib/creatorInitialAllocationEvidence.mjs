/** Conservative creator initial-allocation evidence.
 * A Pump.fun creation does not imply a creator purchase or token allocation.
 * Only independently verified, mint-bound launch distributions count.
 */
export function assessCreatorInitialAllocation({mint,creator,launchTimestamp,distributions=[],coverageComplete=false}={}){
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint||'')||
 !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator||'')||
 !Number.isSafeInteger(launchTimestamp)||launchTimestamp<=0||!Array.isArray(distributions))throw Error('INVALID_INITIAL_ALLOCATION_INPUT');
 coverageComplete=coverageComplete===true;
 const seen=new Set();let total=0n;const evidence=[];
 for(const x of distributions){
  if(!x||x.mint!==mint||x.recipient!==creator||x.verifiedLaunchDistribution!==true||
   !x.instructionVerified||!x.signature||seen.has(x.signature)||
   !Number.isSafeInteger(x.timestamp)||x.timestamp<launchTimestamp||
   !/^[0-9]+$/.test(String(x.amountRaw)))continue;
  seen.add(x.signature);total+=BigInt(x.amountRaw);
  evidence.push({signature:x.signature,amountRaw:String(x.amountRaw)});
 }
 return {status:coverageComplete?'INITIAL_ALLOCATION_EVIDENCE_COMPLETE':'INITIAL_ALLOCATION_INCOMPLETE',
  verifiedObservedRaw:total.toString(),initialAttributableRaw:coverageComplete?total.toString():null,
  coverageComplete:coverageComplete===true,evidence,
  zeroAllocationVerified:coverageComplete===true&&total===0n};
}

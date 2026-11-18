import {assessCreatorInitialAllocation} from './creatorInitialAllocationEvidence.mjs';
/** Adapt independently verified launch-instruction events, never balance movements,
 * buys or wallet-history exhaustion. No decoder or coverage authority is invented.
 * Retained records are preserved verbatim; conflicts are withheld by assessment.
 */
export function produceCreatorLaunchDistributions({mint,creator,launchTimestamp,events=[],retainedDistributions=[]}={}){
 if(!Array.isArray(events)||!Array.isArray(retainedDistributions))throw Error('INVALID_LAUNCH_DISTRIBUTION_INPUT');
 const distributions=structuredClone(retainedDistributions);
 let rejectedEvents=0;
 for(const event of events){
  if(event?.type!=='LAUNCH_DISTRIBUTION')continue;
  if(event.mint!==mint||event.creator!==creator||event.independentlyVerified!==true||
   event.launchInstructionVerified!==true||event.instructionVerified!==true||
   typeof event.signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(event.signature)||
   !Number.isSafeInteger(event.instructionIndex)||event.instructionIndex<0||
   !Object.hasOwn(event,'innerInstructionIndex')||(event.innerInstructionIndex!==null&&(!Number.isSafeInteger(event.innerInstructionIndex)||event.innerInstructionIndex<0))||
   !Number.isSafeInteger(event.timestamp)||event.timestamp<launchTimestamp||
   typeof event.amountRaw!=='string'||!/^\d+$/.test(event.amountRaw)){rejectedEvents++;continue;}
  const record={mint,recipient:creator,signature:event.signature,instructionIndex:event.instructionIndex,
   innerInstructionIndex:event.innerInstructionIndex,timestamp:event.timestamp,amountRaw:BigInt(event.amountRaw).toString(),
   verifiedLaunchDistribution:true,instructionVerified:true};
  // Compare complete semantic records, not identity alone: never overwrite a conflict.
  if(!distributions.some(x=>x&&Object.keys(record).every(key=>x[key]===record[key])))distributions.push(record);
 }
 const allocation=assessCreatorInitialAllocation({mint,creator,launchTimestamp,distributions,coverageComplete:false});
 return {verifiedLaunchDistributions:distributions,launchDistributionCoverageComplete:false,
  launchDistributionEvidence:{version:1,status:'INITIAL_ALLOCATION_COVERAGE_UNPROVEN',
   rejectedEvents,observedInstructionCount:allocation.evidence.filter(x=>Object.hasOwn(x,'instructionIndex')).length,
   verifiedObservedRaw:allocation.verifiedObservedRaw,initialAttributableRaw:null,zeroAllocationVerified:false}};
}

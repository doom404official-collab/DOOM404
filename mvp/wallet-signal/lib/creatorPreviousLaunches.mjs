/** Evidence-only creator previous launches summary.
 * A shared creator wallet alone is not sufficient proof of beneficial ownership.
 */
export function summarizePreviousLaunches({creator,launches=[]}={}){
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator||'')||!Array.isArray(launches))throw Error('INVALID_PREVIOUS_LAUNCH_INPUT');
 const attributed=[],unresolved=[];
 const seen=new Set();
 for(const item of launches){
  if(!item||typeof item.mint!=='string'||seen.has(item.mint))continue;
  seen.add(item.mint);
  if(item.launchCreator!==creator||item.creationInstructionVerified!==true||
     !item.creationSignature||!item.decoderVersion){unresolved.push(item.mint);continue;}
  attributed.push({mint:item.mint,creationSignature:item.creationSignature,launchTimestamp:item.launchTimestamp||null,
   earlySelling:item.earlySellingVerified===true?item.earlySellingObserved===true?true:false:null,
   liquidityWithdrawal:item.liquidityWithdrawalVerified===true?item.liquidityWithdrawalObserved===true?true:false:null,
   observationWindowComplete:item.observationWindowComplete===true});
 }
 return {status:'HISTORICAL_LAUNCH_EVIDENCE',attributedLaunches:attributed,
  attributedLaunchCount:attributed.length,unresolvedMints:unresolved,
  comparableLaunchCount:attributed.filter(x=>x.observationWindowComplete).length,
  previousLaunchesScoreEligible:attributed.length>0&&attributed.every(x=>x.observationWindowComplete&&x.earlySelling!==null&&x.liquidityWithdrawal!==null),
  noPriorLaunchesVerified:false};
}

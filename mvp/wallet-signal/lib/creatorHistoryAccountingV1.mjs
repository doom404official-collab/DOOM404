import {summarizeCreatorAcquisitionLedger} from './creatorAcquisitionLedger.mjs';
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Exact raw-unit balance equation. An arithmetic match is not archival proof.
 * Boundary balances and continuous history must be explicitly certified by the
 * caller before FULLY_RECONCILED can be returned. */
export function reconcileCreatorHistoryWindow({mint,creator,events=[],openingBalanceRaw=null,closingBalanceRaw=null,openingVerified=false,closingVerified=false,continuousHistoryVerified=false}={}){
 const ledger=summarizeCreatorAcquisitionLedger({mint,creator,events,historyComplete:false,attributionComplete:false});
 const inflow=BigInt(ledger.totalAcquiredRaw),outflow=BigInt(ledger.externalTransferredOutRaw)+BigInt(ledger.verifiedSoldRaw)+BigInt(ledger.burnedRaw);
 const opening=uint(openingBalanceRaw)&&openingVerified===true?BigInt(openingBalanceRaw):null,closing=uint(closingBalanceRaw)&&closingVerified===true?BigInt(closingBalanceRaw):null;
 const expected=opening===null?null:opening+inflow-outflow,difference=expected===null||closing===null?null:closing-expected;
 const complete=opening!==null&&closing!==null&&continuousHistoryVerified===true&&ledger.rejected.length===0;
 return {version:1,mint,creator,status:complete&&difference===0n?'FULLY_RECONCILED':difference!==null&&difference!==0n?'UNEXPLAINED_HISTORICAL_DIFFERENCE':opening!==null&&closing!==null?'PARTIALLY_RECONCILED':closing!==null?'VERIFIED_CURRENT_BALANCE_ONLY':ledger.acceptedCount?'PARTIAL_HISTORICAL_EVENTS':'NO_MATCHING_EVENTS_RECOVERED',
  openingBalanceRaw:opening?.toString()??null,verifiedInflowsRaw:inflow.toString(),verifiedOutflowsRaw:outflow.toString(),expectedClosingRaw:expected?.toString()??null,closingBalanceRaw:closing?.toString()??null,unexplainedDifferenceRaw:difference?.toString()??null,
  acceptedEventCount:ledger.acceptedCount,rejectedEventCount:ledger.rejected.length,continuousHistoryVerified:continuousHistoryVerified===true,historyComplete:complete&&difference===0n,
  qualification:complete?'Boundary balances and continuous window supplied by verified producer.':'Bounded events are not a continuous balance ledger; no lifetime inactivity or complete reconciliation claim.'};
}
/** Suppress exact semantic duplicates while retaining conflicting variants so
 * the ledger's instruction-level conflict rejection still fails closed. */
export function deduplicateCreatorEvents(events=[]){
 const seen=new Set();return events.filter(e=>{const x={signature:e?.signature,instructionIndex:e?.instructionIndex,innerInstructionIndex:e?.innerInstructionIndex??null,mint:e?.mint,creator:e?.creator,type:e?.type,timestamp:e?.timestamp,amountRaw:String(e?.amountRaw),independentlyVerified:e?.independentlyVerified,instructionVerified:e?.instructionVerified,settlementVerified:e?.settlementVerified,mintInstructionVerified:e?.mintInstructionVerified,launchInstructionVerified:e?.launchInstructionVerified,burnInstructionVerified:e?.burnInstructionVerified,bothWalletsAttributed:e?.bothWalletsAttributed};const k=JSON.stringify(x);if(seen.has(k))return false;seen.add(k);return true;});
}
/** Bounded public diagnostic projection. No raw transactions, arbitrary text or
 * score eligibility escapes the retained worker observation. */
export function projectCreatorHistoryAccounting(value,mint,creator){
 const statuses=new Set(['FULLY_RECONCILED','UNEXPLAINED_HISTORICAL_DIFFERENCE','PARTIALLY_RECONCILED','VERIFIED_CURRENT_BALANCE_ONLY','PARTIAL_HISTORICAL_EVENTS','NO_MATCHING_EVENTS_RECOVERED']);
 if(value?.version!==1||value.mint!==mint||value.creator!==creator||!statuses.has(value.status))return null;
 const raw=x=>x===null?null:typeof x==='string'&&/^-?(0|[1-9][0-9]{0,39})$/.test(x)?x:undefined;
 const keys=['openingBalanceRaw','verifiedInflowsRaw','verifiedOutflowsRaw','expectedClosingRaw','closingBalanceRaw','unexplainedDifferenceRaw'],out={version:1,mint,creator,status:value.status};
 for(const k of keys){out[k]=raw(value[k]);if(out[k]===undefined)return null;}
 if(out.verifiedInflowsRaw===null||out.verifiedOutflowsRaw===null||BigInt(out.verifiedInflowsRaw)<0n||BigInt(out.verifiedOutflowsRaw)<0n)return null;
 for(const k of ['openingBalanceRaw','closingBalanceRaw'])if(out[k]!==null&&BigInt(out[k])<0n)return null;
 for(const k of ['acceptedEventCount','rejectedEventCount']){if(!Number.isSafeInteger(value[k])||value[k]<0||value[k]>100000)return null;out[k]=value[k];}
 const equation=out.openingBalanceRaw!==null&&out.closingBalanceRaw!==null&&out.expectedClosingRaw!==null&&out.unexplainedDifferenceRaw!==null&&BigInt(out.expectedClosingRaw)===BigInt(out.openingBalanceRaw)+BigInt(out.verifiedInflowsRaw)-BigInt(out.verifiedOutflowsRaw)&&BigInt(out.unexplainedDifferenceRaw)===BigInt(out.closingBalanceRaw)-BigInt(out.expectedClosingRaw);
 out.continuousHistoryVerified=value.continuousHistoryVerified===true;out.historyComplete=value.status==='FULLY_RECONCILED'&&value.historyComplete===true&&out.continuousHistoryVerified&&equation&&out.unexplainedDifferenceRaw==='0'&&out.rejectedEventCount===0;
 if(value.status==='FULLY_RECONCILED'&&!out.historyComplete)return null;
 out.qualification=out.historyComplete?'Verified boundary equation within a continuous assessed window.':'Partial diagnostic; no lifetime reconciliation or inactivity conclusion.';return out;
}

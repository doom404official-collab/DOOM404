/** Read-only integer accounting diagnostic. No score or evidence eligibility changes. */
export function reconcileHistoricalAmounts({openingRaw=null,purchasesRaw,otherInflowsRaw=null,salesRaw,burnsRaw,transfersRaw,otherOutflowsRaw=null,closingRaw,boundariesCompatible=false,historyComplete=false}={}){
 const raw=x=>typeof x==='string'&&/^[0-9]+$/.test(x)?BigInt(x):null;
 const p=raw(purchasesRaw),s=raw(salesRaw),b=raw(burnsRaw),t=raw(transfersRaw),c=raw(closingRaw),o=raw(openingRaw),i=raw(otherInflowsRaw),u=raw(otherOutflowsRaw);
 const observedNet=p!==null&&s!==null&&b!==null&&t!==null?p-s-b-t:null;
 const complete=boundariesCompatible&&historyComplete&&[o,i,u,observedNet,c].every(x=>x!==null);
 const expected=complete?o+observedNet+i-u:null;
 return {classification:complete?'COMPLETE_ACCOUNTING_COMPARISON':'BOUNDED_HISTORICAL_EVIDENCE',observedNetRaw:observedNet?.toString()??null,diagnosticDifferenceRaw:observedNet!==null&&c!==null?(c-observedNet).toString():null,expectedClosingRaw:expected?.toString()??null,residualRaw:expected!==null?(c-expected).toString():null,openingBalanceEstablished:o!==null,closingBoundaryCompatible:boundariesCompatible===true,salesStatus:s===null?'NOT_ASSESSED':historyComplete&&boundariesCompatible&&s===0n?'VERIFIED_ZERO_WITHIN_WINDOW':s===0n?'NO_MATCHING_EVENTS_RECOVERED':'OBSERVED_SALES'};
}

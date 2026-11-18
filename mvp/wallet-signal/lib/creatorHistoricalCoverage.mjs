/** Distinguish provider pagination exhaustion from full transaction verification.
 * An exhausted RPC response is not proof of archival completeness.
 */
export function assessCreatorHistoricalCoverage({rpcExhausted=false,pendingSignatures=[],processedSignatures=[],archiveVerified=false}={}){
 if(!Array.isArray(pendingSignatures)||!Array.isArray(processedSignatures))throw Error('INVALID_CREATOR_COVERAGE');
 const processed=new Set(processedSignatures),pending=new Set(pendingSignatures.filter(x=>!processed.has(x)));
 const transactionsComplete=pending.size===0;
 return {rpcPaginationExhausted:rpcExhausted===true,archiveVerified:archiveVerified===true,
  processedCount:processed.size,pendingCount:pending.size,transactionsComplete,
  historyComplete:transactionsComplete&&rpcExhausted===true&&archiveVerified===true,
  status:pending.size?'TRANSACTIONS_PENDING':!archiveVerified?'ARCHIVE_COVERAGE_UNVERIFIED':
   rpcExhausted?'HISTORY_COMPLETE':'PAGINATION_INCOMPLETE'};
}

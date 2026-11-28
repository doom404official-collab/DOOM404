/** Provider diagnostics are observations about a request, never execution proof.
 * Do not retain provider messages, URLs, credential-bearing bodies or transactions. */
export function quoteFailureReason(error,signal){
 if(signal?.aborted||['AbortError','TimeoutError'].includes(error?.name)||error?.code==='QUOTE_TIMEOUT')return 'provider_timeout';
 return ({QUOTE_AUTH:'provider_access_unavailable',QUOTE_RATE_LIMIT:'provider_rate_limited',QUOTE_HTTP:'provider_http_failure',QUOTE_NO_ROUTE:'no_route_returned',QUOTE_INVALID:'invalid_quote_response',QUOTE_JSON:'invalid_quote_response',QUOTE_AMOUNT:'reference_amount_out_of_range'})[error?.code]||'provider_error';
}
export function unavailableReferenceQuote(size,{reason,baseInputRaw=null,observedAt}={}){
 return {referenceNotional:size,referenceNotionalSol:size,quoteSymbol:'SOL',baseInputRaw,executable:null,failureReason:reason||'quote_unavailable',measurement:'unavailable_execution_estimate',feeCoverage:'unverified',...(observedAt?{observedAt}:{})};
}
export function summarizeQuoteDiagnostics(diagnostics=[]){
 const reasons=[...new Set(diagnostics.map(x=>x?.status).filter(x=>typeof x==='string'))];
 const provider=reasons.find(r=>r.startsWith('provider_'));
 return {status:provider?'provider_temporarily_unavailable':'quote_unavailable',reason:provider||reasons.find(r=>r!=='no_validated_reference_quotes')||'no_validated_quote_evidence',executionRestrictionEstablished:false};
}

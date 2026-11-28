export function summarizeLiquidityRetryCoverage(report={}) {
 const decoded=Array.isArray(report.decodedTransactions)?report.decodedTransactions:[];
 const unavailable=decoded.filter(t=>t.status==="unavailable");
 const successes=decoded.filter(t=>t.status!=="unavailable");
 const codes={};
 for(const item of unavailable){const code=item.errorCode??"UNKNOWN";codes[code]=(codes[code]??0)+1;}
 return {attempted:decoded.length,retrieved:successes.length,unavailable:unavailable.length,excludedSignatures:report.excludedSignatures??0,errorCounts:codes,historyComplete:false,withdrawalCoverageComplete:false};
}

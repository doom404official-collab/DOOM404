export function classifyLiquidityRpcFailure(error) {
 const message=String(error?.message??"");
 if(/429|rate.limit/i.test(message))return "RATE_LIMITED";
 if(/timeout|aborted|abort/i.test(message))return "TIMEOUT";
 if(/version|unsupported transaction/i.test(message))return "UNSUPPORTED_VERSION";
 if(/history|not available|not found/i.test(message))return "HISTORY_UNAVAILABLE";
 if(/403|401|unauthori|forbidden/i.test(message))return "PROVIDER_AUTH";
 if(/503|502|500|unavailable/i.test(message))return "PROVIDER_UNAVAILABLE";
 return "RPC_RETRIEVAL_ERROR";
}

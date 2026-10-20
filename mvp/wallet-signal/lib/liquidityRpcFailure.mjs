export function classifyLiquidityRpcFailure(error) {
 const message=String(error?.message??"");
 if(/429|rate.limit/i.test(message))return "RATE_LIMITED";
 if(/timeout|aborted|abort/i.test(message))return "TIMEOUT";
 if(/unsupported transaction version|transaction version.*not supported|maxsupportedtransactionversion/i.test(message))return "UNSUPPORTED_VERSION";
 if(/invalid.*(version|transaction)|failed to deserialize|failed to decode|superstruct|expected.*(object|array)/i.test(message))return "CLIENT_DECODE_ERROR";
 if(/history|not available|not found/i.test(message))return "HISTORY_UNAVAILABLE";
 if(/403|401|unauthori|forbidden/i.test(message))return "PROVIDER_AUTH";
 if(/503|502|500|unavailable/i.test(message))return "PROVIDER_UNAVAILABLE";
 return "RPC_RETRIEVAL_ERROR";
}
export function describeLiquidityRpcFailure(error) {
 const message=String(error?.message??"");
 const rpcCode=Number.isInteger(error?.code)?error.code:null;
 return {errorCode:classifyLiquidityRpcFailure(error),rpcCode,errorClass:typeof error?.name==="string"?error.name.slice(0,64):"UnknownError",versionRequested:0,detailsRedacted:true};
}

import {validParsedLiquidityV1} from './liquidityParsedV1.mjs';
export function isUnsupportedTransactionVersion(error){
 const message=String(error?.message||error||"");
 return message==='RPC_-32015'||/unsupported transaction version|transaction version.*not supported|maxSupportedTransactionVersion/i.test(message);
}
export async function retrieveHistoricalTransaction(call,url,signature){
 const options={encoding:"jsonParsed",maxSupportedTransactionVersion:0};
 try{return await call(url,"getTransaction",[signature,options]);}
 catch(error){
  if(!isUnsupportedTransactionVersion(error))throw error;
  // Only retry on explicit version incompatibility; no authorization inference.
  const tx=await call(url,"getTransaction",[signature,{...options,maxSupportedTransactionVersion:1}]);
  if(!validParsedLiquidityV1(tx)||tx.transaction.signatures[0]!==signature)throw Error('TRANSACTION_V1_FALLBACK_UNRESOLVED');
  return tx;
 }
}

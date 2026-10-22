export function isUnsupportedTransactionVersion(error){
 const message=String(error?.message||error||"");
 return /unsupported transaction version|transaction version.*not supported|maxSupportedTransactionVersion/i.test(message);
}
export async function retrieveHistoricalTransaction(call,url,signature){
 const options={encoding:"jsonParsed",maxSupportedTransactionVersion:0};
 try{return await call(url,"getTransaction",[signature,options]);}
 catch(error){
  if(!isUnsupportedTransactionVersion(error))throw error;
  // Only retry on explicit version incompatibility; no authorization inference.
  return call(url,"getTransaction",[signature,{...options,maxSupportedTransactionVersion:1}]);
 }
}

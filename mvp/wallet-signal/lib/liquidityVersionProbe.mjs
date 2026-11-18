export function inspectVersionRejection(error) {
 const code=Number.isInteger(error?.code)?error.code:null;
 const message=String(error?.message??"");
 const match=message.match(/(?:maxSupportedTransactionVersion|version)\s*[:=]?\s*(\d+)/i);
 const advertised=match?Number(match[1]):null;
 return {
  rpcCode:code,
  versionRejection:code===-32015,
  versionHint:Number.isSafeInteger(advertised)?advertised:null,
  requiresProviderCompatibilityReview:true,
  automaticVersionUpgrade:false
 };
}

/**
 * Deterministic, resumable per-wallet signature pagination.
 * A short page is only provider-observed exhaustion, not proof of full archive.
 * Caller owns RPC budget, checkpoint persistence and transaction decoding.
 */
export async function collectWalletSignaturePage({wallet,cursor=null,limit=1000,fetchPage}={}){
 if(typeof wallet!=="string"||!wallet||typeof fetchPage!=="function")throw Error("INVALID_PAGINATION_INPUT");
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error("INVALID_PAGE_LIMIT");
 const entries=await fetchPage(wallet,{before:cursor||undefined,limit});
 if(!Array.isArray(entries))throw Error("INVALID_SIGNATURE_PAGE");
 const seen=new Set(),signatures=[];
 for(const entry of entries){
  if(!entry||typeof entry.signature!=="string")throw Error("INVALID_SIGNATURE_ENTRY");
  if(seen.has(entry.signature))throw Error("DUPLICATE_SIGNATURE_PAGE");
  seen.add(entry.signature);
  if(entry.err==null)signatures.push(entry.signature);
 }
 const nextCursor=entries.at(-1)?.signature||null;
 if(entries.length===limit&&(!nextCursor||nextCursor===cursor))throw Error("PAGINATION_STALLED");
 return {wallet,signatures,nextCursor,entriesSeen:entries.length,
  providerPageExhausted:entries.length<limit,
  archiveCompletenessProven:false};
}

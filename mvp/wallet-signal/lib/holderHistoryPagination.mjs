/**
 * Deterministic, resumable per-wallet signature pagination.
 * A short page is only provider-observed exhaustion, not proof of full archive.
 * Caller owns RPC budget, checkpoint persistence and transaction decoding.
 */
export async function collectWalletSignaturePage({wallet,cursor=null,cursorSlot=null,limit=1000,fetchPage}={}){
 if(typeof wallet!=="string"||!wallet||typeof fetchPage!=="function")throw Error("INVALID_PAGINATION_INPUT");
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error("INVALID_PAGE_LIMIT");
 if(cursor!==null&&(typeof cursor!=='string'||!cursor.trim()))throw Error('INVALID_PAGINATION_CURSOR');
 if(cursorSlot!==null&&(!Number.isSafeInteger(cursorSlot)||cursorSlot<0))throw Error('INVALID_PAGINATION_SLOT');
 const entries=await fetchPage(wallet,{before:cursor||undefined,limit});
 if(!Array.isArray(entries)||entries.length>limit)throw Error("INVALID_SIGNATURE_PAGE");
 const seen=new Set(),signatures=[];let previousSlot=cursorSlot;
 for(const entry of entries){
  if(!entry||typeof entry.signature!=="string"||!entry.signature.trim()||!Object.hasOwn(entry,"err")||!Number.isSafeInteger(entry.slot)||entry.slot<0)throw Error("INVALID_SIGNATURE_ENTRY");
  if(seen.has(entry.signature))throw Error("DUPLICATE_SIGNATURE_PAGE");
  if(entry.signature===cursor)throw Error('PAGINATION_STALLED');
  if(previousSlot!==null&&entry.slot>previousSlot)throw Error('SIGNATURE_PAGE_ORDER_INVALID');
  previousSlot=entry.slot;
  if(entry.err!==null&&(typeof entry.err!=='object'&&typeof entry.err!=='string'||Array.isArray(entry.err)))throw Error('INVALID_SIGNATURE_ENTRY');
  seen.add(entry.signature);
  if(entry.err===null)signatures.push(entry.signature);
 }
 const nextCursor=entries.at(-1)?.signature??cursor;
 if(entries.length===limit&&(!nextCursor||nextCursor===cursor))throw Error("PAGINATION_STALLED");
 return {wallet,signatures,nextCursor,oldestSlot:entries.at(-1)?.slot??cursorSlot,entriesSeen:entries.length,
  providerPageExhausted:entries.length<limit,
  archiveCompletenessProven:false};
}

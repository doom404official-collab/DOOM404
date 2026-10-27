/**
 * Versioned, portable read-only investigation checkpoint.
 * JSON is intended for GitHub Actions artifacts, never as an attribution write.
 */
export function createHolderHistoryCheckpoint({mint,holders=[]}={}){
 if(typeof mint!=="string"||!mint||!Array.isArray(holders)||holders.length<1||holders.length>20)throw Error("INVALID_HOLDER_SET");
 const wallets=[...new Set(holders.map(h=>h.ownerWallet))];
 if(wallets.some(w=>typeof w!=="string"||!w))throw Error("UNRESOLVED_HOLDER_OWNER");
 return {version:1,mint,holders:holders.map(h=>({...h})),
  wallets:Object.fromEntries(wallets.map(w=>[w,{cursor:null,pages:0,signaturesSeen:0,exhausted:false}])),
  signatures:{},edges:{},failedSignatures:{},archiveCompletenessProven:false};
}
export function recordHistoryPage(checkpoint,{wallet,page}){
 const state=checkpoint.wallets[wallet];
 if(!state||state.exhausted)throw Error("WALLET_NOT_PENDING");
 if(!page||page.wallet!==wallet||!Array.isArray(page.signatures))throw Error("INVALID_PAGE");
 if(state.cursor&&state.cursor===page.nextCursor&&!page.providerPageExhausted)throw Error("PAGINATION_STALLED");
 state.cursor=page.nextCursor;
 if(page.oldestSlot!==null&&page.oldestSlot!==undefined)state.oldestSlot=page.oldestSlot;
 state.pages++;
 state.signaturesSeen+=page.entriesSeen;
 state.exhausted=page.providerPageExhausted;
 for(const signature of page.signatures)if(!(signature in checkpoint.signatures))checkpoint.signatures[signature]="pending";
 return checkpoint;
}
export function recordDecodedTransaction(checkpoint,{signature,transfers=[],error=null}){
 if(!(signature in checkpoint.signatures))throw Error("SIGNATURE_NOT_DISCOVERED");
 if(error){checkpoint.failedSignatures[signature]=String(error).slice(0,120);checkpoint.signatures[signature]="failed";return checkpoint;}
 checkpoint.signatures[signature]="checked";
 for(const tx of transfers){
  if(!tx?.confirmed||!tx?.directInteraction||!Array.isArray(tx.participants)||tx.participants.length!==2)continue;
  const [a,b]=[...tx.participants].sort();
  if(!(a in checkpoint.wallets)||!(b in checkpoint.wallets)||a===b)continue;
  const key=a+"|"+b;
  if(!checkpoint.edges[key])checkpoint.edges[key]={walletA:a,walletB:b,signatures:[]};
  if(!checkpoint.edges[key].signatures.includes(signature))checkpoint.edges[key].signatures.push(signature);
 }
 return checkpoint;
}
export function summarizeHistoryCheckpoint(checkpoint){
 const wallets=Object.values(checkpoint.wallets);
 const signatures=Object.values(checkpoint.signatures);
 return {walletsTotal:wallets.length,walletsProviderExhausted:wallets.filter(w=>w.exhausted).length,
  signaturesDiscovered:signatures.length,transactionsChecked:signatures.filter(s=>s==="checked").length,
  transactionsFailed:signatures.filter(s=>s==="failed").length,
  transactionsPending:signatures.filter(s=>s==="pending").length,
  directEdges:Object.values(checkpoint.edges).length,
  providerHistoryExhausted:wallets.every(w=>w.exhausted)&&signatures.every(s=>s==="checked"),
  archiveCompletenessProven:false};
}

/**
 * Versioned, portable read-only investigation checkpoint.
 * JSON is intended for GitHub Actions artifacts, never as an attribution write.
 */
// Operational replay metadata only: no historical evidence is pruned or rebuilt.
export const HOLDER_PAGE_REPLAY_WINDOW=16;
function pageReplayWindow(state){
 const cursor=value=>typeof value==='string'&&value.length>0&&value.length<=88;
 if(!Object.hasOwn(state,'pageReplay')){
  if(state.cursor!==null&&state.cursor!==undefined&&!cursor(state.cursor))throw Error('INVALID_PAGE_REPLAY_WINDOW');
  return state.cursor?[state.cursor]:[];
 }
 const replay=state.pageReplay;
 if(!replay||replay.version!==1||replay.priorHistoryVerified!==false||!Array.isArray(replay.cursors)||replay.cursors.length<1||replay.cursors.length>HOLDER_PAGE_REPLAY_WINDOW||replay.cursors.some(value=>!cursor(value))||new Set(replay.cursors).size!==replay.cursors.length||replay.cursors.at(-1)!==state.cursor)throw Error('INVALID_PAGE_REPLAY_WINDOW');
 if(Object.hasOwn(replay,'stalledCursor')&&(!cursor(replay.stalledCursor)||!replay.cursors.includes(replay.stalledCursor)))throw Error('INVALID_PAGE_REPLAY_WINDOW');
 return replay.cursors;
}
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
 const recent=pageReplayWindow(state);
 if(state.pageReplay?.stalledCursor)throw Error('PAGINATION_REPLAY_REVIEW_REQUIRED');
 if(!Number.isSafeInteger(page.entriesSeen)||page.entriesSeen<0)throw Error('INVALID_PAGE');
 if(page.entriesSeen>0){
  if(typeof page.nextCursor!=='string'||!page.nextCursor||page.nextCursor.length>88)throw Error('INVALID_PAGE_CURSOR');
  if(recent.includes(page.nextCursor)){
   state.pageReplay={version:1,cursors:[...recent],priorHistoryVerified:false,stalledCursor:page.nextCursor};
   throw Error('PAGINATION_REPLAY_DETECTED');
  }
  // Seed only the already persisted boundary for legacy state, never old pages.
  // A bounded window cannot prove that older/unobserved history is replay-free.
  state.pageReplay={version:1,cursors:[...recent,page.nextCursor].slice(-HOLDER_PAGE_REPLAY_WINDOW),priorHistoryVerified:false};
 }
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

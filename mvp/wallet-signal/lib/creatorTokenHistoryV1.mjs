import {verifyBoundedCreatorOrigin} from './boundedCreatorOriginV2.mjs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
const PROGRAMS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const key=k=>typeof k==='string'?k:k?.pubkey;
// SPL Transfer does not carry the mint as an instruction account. Finalized
// token-balance metadata binds those transactions to the assessed mint.
export function creatorTransactionMentionsMint(tx,mint){
 const keys=tx?.transaction?.message?.accountKeys||[];
 return keys.some(k=>key(k)===mint)||['preTokenBalances','postTokenBalances'].some(name=>(tx?.meta?.[name]||[]).some(b=>b.mint===mint&&Number.isSafeInteger(b.accountIndex)&&b.accountIndex>=0&&b.accountIndex<keys.length&&PROGRAMS.has(b.programId)&&uint(b.uiTokenAmount?.amount)));
}
function ownedAccounts(tx,mint,creator){
 const keys=tx?.transaction?.message?.accountKeys||[];
 return ['preTokenBalances','postTokenBalances'].flatMap(name=>(tx?.meta?.[name]||[]).filter(b=>b.mint===mint&&b.owner===creator&&PROGRAMS.has(b.programId)&&uint(b.uiTokenAmount?.amount)).map(b=>key(keys[b.accountIndex]))).filter(address);
}
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
const address=x=>{try{return typeof x==='string'&&new PublicKey(x).toBase58()===x;}catch{return false;}};
/** A deterministic ATA address is a discovery candidate, never ownership proof.
 * Its history may survive account closure. Only finalized receipt metadata can
 * establish that this mint/creator actually used it. */
export function deriveHistoricalCreatorAccountCandidate({mint,creator,transaction}={}){
 try{
  const programs=new Set(['preTokenBalances','postTokenBalances'].flatMap(n=>(transaction?.meta?.[n]||[]).filter(b=>b.mint===mint&&PROGRAMS.has(b.programId)).map(b=>b.programId)));
  for(const ix of [...(transaction?.transaction?.message?.instructions||[]),...(transaction?.meta?.innerInstructions||[]).flatMap(g=>g.instructions||[])])if(PROGRAMS.has(ix.programId)&&['initializeMint','initializeMint2'].includes(ix.parsed?.type)&&ix.parsed.info?.mint===mint)programs.add(ix.programId);
  if(programs.size!==1||!address(mint)||!address(creator))return null;
  const program=[...programs][0],ata=PublicKey.findProgramAddressSync([new PublicKey(creator).toBuffer(),new PublicKey(program).toBuffer(),new PublicKey(mint).toBuffer()],new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'))[0].toBase58();
  return {address:ata,tokenProgram:program,basis:'derived_associated_account_candidate',ownershipVerified:false};
 }catch{return null;}
}

// Cursor progress certifies retrieval under a particular event decoder set.
// Replaying after a decoder upgrade preserves facts, but must revisit pages
// whose previously unsupported instructions may now be understood.
export const CREATOR_HISTORY_DECODER_EPOCH='creator-history-decoders-v11';
export function prepareCreatorHistoryCheckpoint(observation,mint,creator,now=Date.now()){
 const p=observation?.creatorHistoryCheckpoint;
 if(observation?.mint!==mint||p?.mint!==mint||p.creator!==creator)return null;
 const lastWindowAssessedAt=p.lastWindowAssessedAt??observation.observedAt;
 const refresh=p.addressWindowExhausted===true&&Number.isFinite(Date.parse(lastWindowAssessedAt))&&now-Date.parse(lastWindowAssessedAt)>=3600000;
 if(p.decoderEpoch===CREATOR_HISTORY_DECODER_EPOCH&&!refresh)return p;
 return {version:1,mint,creator,accountAssociations:p.accountAssociations||[],decoderEpoch:CREATOR_HISTORY_DECODER_EPOCH,completedTargets:[],historyComplete:false,replayReason:refresh&&p.decoderEpoch===CREATOR_HISTORY_DECODER_EPOCH?'exhausted_window_freshness_refresh':'event_decoder_epoch_changed'};
}
/** Recover token-account-specific history, including an account visible in the
 * creation transaction that has since closed. The indexed result is evidence
 * only after mint/time/transaction identity validation. Completion of this
 * Alchemy's paginationToken is persisted and resumed; legacy observations using
 * paginationKey are read for compatibility, never sent as an RPC option.
 * Completion of this address window is never completion of a wallet's lifetime history. */
export async function collectCreatorTokenHistory({mint,creator,origin,read,previous=null,knownTransactions=[],now=Date.now,maxPages=1}={}){
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>3)throw Error('INVALID_HISTORY_PAGE_LIMIT');
 const result={currentWallet:null,transactions:[],status:'evidence_unavailable',additionalRequests:0,targetAddress:null,checkpoint:null,diagnostics:{candidatesReturned:0,transactionsRetained:0,duplicates:0,rejectedIdentity:0,rejectedTime:0,rejectedMint:0},limitations:[]};
 let accounts=[],inventoryResponse=null;
 try{
  result.additionalRequests++;const response=await read('getTokenAccountsByOwner',[creator,{mint},{encoding:'jsonParsed',commitment:'finalized'}]);
  if(!Number.isSafeInteger(response?.context?.slot)||!Array.isArray(response.value)||response.value.length>1000)throw Error();
  let balance=0n;const seen=new Set();
  for(const row of response.value){const a=row?.account,i=a?.data?.parsed?.info;
   if(!address(row?.pubkey)||seen.has(row.pubkey)||a?.executable!==false||!PROGRAMS.has(a.owner)||a.data.parsed.type!=='account'||i?.mint!==mint||i.owner!==creator||!uint(i.tokenAmount?.amount))throw Error();
   balance+=BigInt(i.tokenAmount.amount);seen.add(row.pubkey);accounts.push({address:row.pubkey,amountRaw:i.tokenAmount.amount});
  }
  if(balance>18446744073709551615n)throw Error();
  inventoryResponse=response;
  result.currentWallet={rawBalance:balance.toString(),slot:response.context.slot,observedAt:new Date(now()).toISOString(),accountCount:accounts.length};
 }catch{result.limitations.push('Current token account inventory unavailable; historical creation-account evidence may still be inspected.');}
 const keys=origin?.tx?.transaction?.message?.accountKeys||[];
 const launchAccounts=(origin?.tx?.meta?.postTokenBalances||[]).filter(b=>b.mint===mint&&b.owner===creator).map(b=>key(keys[b.accountIndex])).filter(address);
 const bound=previous?.version===1&&previous.mint===mint&&previous.creator===creator;
 // Private durable checkpoints preserve historical associations even when the
 // bounded raw-transaction cache rotates. These are past ownership observations,
 // never claims of present ownership or complete archival discovery.
 const retainedAssociations=bound&&Array.isArray(previous.accountAssociations)?previous.accountAssociations.slice(0,256).filter(a=>address(a?.address)&&a.mint===mint&&a.owner===creator&&Number.isSafeInteger(a.slot)&&a.slot>=0&&a.decoderVersion==='creator-token-account-association-v1'&&['finalized_token_balance','finalized_owner_inventory'].includes(a.source)&&typeof a.signature==='string'&&a.signature.length<=128):[];
 const associations=new Map(retainedAssociations.map(a=>[a.address,a]));
 for(const tx of knownTransactions.filter(tx=>tx?.meta?.err===null&&Number.isSafeInteger(tx.slot)&&typeof tx.transaction?.signatures?.[0]==='string'))for(const account of ownedAccounts(tx,mint,creator))associations.set(account,{address:account,mint,owner:creator,slot:tx.slot,signature:tx.transaction.signatures[0],source:'finalized_token_balance',decoderVersion:'creator-token-account-association-v1'});
 if(result.currentWallet)for(const a of accounts)associations.set(a.address,{address:a.address,mint,owner:creator,slot:result.currentWallet.slot,signature:'',source:'finalized_owner_inventory',decoderVersion:'creator-token-account-association-v1'});
 const historicalAccounts=[...associations.keys()];
 const targets=[...new Set([...launchAccounts,...historicalAccounts,...accounts.sort((a,b)=>BigInt(a.amountRaw)>BigInt(b.amountRaw)?-1:1).map(a=>a.address)])];
 if(!targets.length){const candidate=deriveHistoricalCreatorAccountCandidate({mint,creator,transaction:origin?.tx});if(candidate){targets.push(candidate.address);result.accountDiscoveryFallback=candidate;result.limitations.push('Derived historical associated account is a retrieval candidate; its existence and creator use require matching finalized transaction evidence.');}}
 const previousToken=previous?.paginationToken??previous?.paginationKey;
 const completedTargets=bound&&Array.isArray(previous.completedTargets)?previous.completedTargets.filter(address).filter(a=>targets.includes(a)).slice(0,1000):[];
 if(bound&&previous.addressWindowExhausted===true&&targets.includes(previous.targetAddress)&&!completedTargets.includes(previous.targetAddress))completedTargets.push(previous.targetAddress);
 const compatible=bound&&!completedTargets.includes(previous.targetAddress)&&targets.includes(previous.targetAddress)&&typeof previousToken==='string'&&previousToken.length<=2048;
 // A creation token account is preferred even after closure. A resumable page
 // stays bound to the verified target rather than to unrelated wallet history.
 const target=compatible?previous.targetAddress:targets.find(a=>!completedTargets.includes(a));
 result.tokenAccountsDiscovered=targets.length;result.tokenAccountsAssessed=completedTargets.length;
 if(!target&&targets.length){result.status='known_token_account_windows_assessed';result.checkpoint={version:1,mint,creator,decoderEpoch:CREATOR_HISTORY_DECODER_EPOCH,lastWindowAssessedAt:previous?.lastWindowAssessedAt??null,accountAssociations:[...associations.values()].slice(0,256),targetAddress:previous?.targetAddress||targets[0],paginationToken:null,addressWindowExhausted:true,completedTargets,historyComplete:false};result.limitations.push('Known token-account windows were assessed; unknown closed accounts and archival completeness remain unverified.');return result;}
 if(!target){result.status='token_account_discovery_unavailable';result.limitations.push('No current or creation token account could be verified. Closed accounts outside the creation transaction remain undiscovered.');return result;}
 result.targetAddress=target;
 const options={transactionDetails:'full',sortOrder:'asc',limit:12,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:1,filters:{status:'succeeded'},...(compatible?{paginationToken:previousToken}:{})};
 try{
  result.additionalRequests++;const page=await read('getTransactionsForAddress',[target,options]);
  const token=page?.paginationToken??page?.paginationKey??null;
  if(!Array.isArray(page?.data)||page.data.length>12||token!=null&&(typeof token!=='string'||token.length>2048))throw Error();
  result.diagnostics.candidatesReturned=page.data.length;const seen=new Set();
  for(const tx of page.data){const signature=tx?.transaction?.signatures?.[0];
   if(typeof signature!=='string'||tx.meta?.err!==null||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)){result.diagnostics.rejectedIdentity++;continue;}
   if(seen.has(signature)){result.diagnostics.duplicates++;continue;}seen.add(signature);
   if(tx.blockTime<origin.proof.creationTime||tx.blockTime>Math.floor(now()/1000)){result.diagnostics.rejectedTime++;continue;}
   if(!creatorTransactionMentionsMint(tx,mint)){result.diagnostics.rejectedMint++;continue;}
   result.transactions.push(tx);
  }
  result.diagnostics.transactionsRetained=result.transactions.length;
  const next=token||null,hasCursor=Object.hasOwn(page,'paginationToken')||Object.hasOwn(page,'paginationKey'),hash=x=>createHash('sha256').update(x).digest('hex'),cursorHistory=compatible&&Array.isArray(previous.cursorHistory)?previous.cursorHistory.filter(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)).slice(-16):[];
  if(next&&(compatible&&next===previousToken||cursorHistory.includes(hash(next))))throw Error('PAGINATION_STALLED');
  result.status='bounded_token_history_assessed';result.candidateCount=page.data.length;result.paginationRemaining=!!next;
  for(const tx of result.transactions)for(const account of ownedAccounts(tx,mint,creator))associations.set(account,{address:account,mint,owner:creator,slot:tx.slot,signature:tx.transaction.signatures[0],source:'finalized_token_balance',decoderVersion:'creator-token-account-association-v1'});
  result.checkpoint={version:1,mint,creator,decoderEpoch:CREATOR_HISTORY_DECODER_EPOCH,lastWindowAssessedAt:new Date(now()).toISOString(),accountAssociations:[...associations.values()].slice(0,256),decoderVersion:'creator-token-history-v2-balance-mint-binding',completedTargets:[...new Set([...completedTargets,...(hasCursor&&!next?[target]:[])])],targetAddress:target,paginationToken:next,addressWindowExhausted:hasCursor&&!next,cursorStatus:hasCursor?(next?'more_history_available':'explicit_address_window_end'):'pagination_metadata_missing',cursorHistory:[...cursorHistory,...(compatible?[hash(previousToken)]:[])].slice(-16),pagesAssessed:(compatible&&Number.isSafeInteger(previous.pagesAssessed)?previous.pagesAssessed:0)+1,historyComplete:false};
  if(next&&maxPages>1){
   // Inventory has just been verified. Reuse that observation only within this
   // call; recursive continuation still consumes a charged indexed RPC read.
   const continuation=await collectCreatorTokenHistory({mint,creator,origin,previous:result.checkpoint,knownTransactions:[...knownTransactions,...result.transactions],now,maxPages:maxPages-1,read:async(method,params)=>method==='getTokenAccountsByOwner'&&inventoryResponse?inventoryResponse:read(method,params)});
   // The inventory adapter above avoids transport but is not a provider call.
   result.additionalRequests+=continuation.additionalRequests-(result.currentWallet?1:0);
   result.transactions.push(...continuation.transactions);
   if(continuation.checkpoint)result.checkpoint=continuation.checkpoint;
   result.paginationRemaining=continuation.paginationRemaining??!!result.checkpoint.paginationToken;
   result.continuationStatus=continuation.status;
   result.limitations.push(...continuation.limitations);
   for(const k of Object.keys(result.diagnostics))result.diagnostics[k]+=continuation.diagnostics[k]||0;
  }
  result.limitations.push('Only the verified target token account has been paged. Other current/closed token accounts and unrelated acquisition mechanisms may remain unobserved.');
 }catch{result.status='targeted_history_unavailable';result.limitations.push('Token-specific indexed history unavailable, malformed, or stalled; no historical inactivity conclusion.');}
 return result;
}
/** Reuse only bounded successful finalized transaction-shaped receipts. No
 * endpoint/credential material is stored. Identity and mint binding are rechecked. */
export function reusableCreatorTransactions(observation,mint,creator){
 if(observation?.mint!==mint||observation.creator?.creator!==creator||!Array.isArray(observation.transactionCache))return [];
 return observation.transactionCache.slice(0,4).filter(tx=>{try{return ['legacy',0,1].includes(tx.version)&&tx.meta?.err===null&&Number.isSafeInteger(tx.slot)&&Number.isSafeInteger(tx.blockTime)&&typeof tx.transaction?.signatures?.[0]==='string'&&creatorTransactionMentionsMint(tx,mint)&&Buffer.byteLength(JSON.stringify(tx))<=24000;}catch{return false;}});
}
export function cacheCreatorTransactions(transactions,mint,creationSignature=null){
 // Verified creation decoders do not use execution logs. Omit verbose logs
 // only on a reverified origin receipt, preserving the existing 24KB/96KB caps.
 const values=[...transactions.values()].map(tx=>tx.transaction?.signatures?.[0]===creationSignature&&verifyBoundedCreatorOrigin(tx,mint)?{...tx,meta:{...tx.meta,logMessages:[]}}:tx);if(creationSignature){const origin=values.find(tx=>tx.transaction?.signatures?.[0]===creationSignature);if(origin)values.splice(values.indexOf(origin),1),values.unshift(origin);}
 let bytes=0;const eligible=values.filter(tx=>{const n=Buffer.byteLength(JSON.stringify(tx));if(n>24000||bytes+n>96000||!creatorTransactionMentionsMint(tx,mint))return false;bytes+=n;return true;});return creationSignature&&eligible[0]?.transaction?.signatures?.[0]===creationSignature?[eligible[0],...eligible.slice(1).slice(-3)]:eligible.slice(-4);
}

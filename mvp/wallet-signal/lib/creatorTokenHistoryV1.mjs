import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
const PROGRAMS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const key=k=>typeof k==='string'?k:k?.pubkey;
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
const address=x=>{try{return typeof x==='string'&&new PublicKey(x).toBase58()===x;}catch{return false;}};
/** Recover token-account-specific history, including an account visible in the
 * creation transaction that has since closed. The indexed result is evidence
 * only after mint/time/transaction identity validation. Completion of this
 * Alchemy's paginationToken is persisted and resumed; legacy observations using
 * paginationKey are read for compatibility, never sent as an RPC option.
 * Completion of this address window is never completion of a wallet's lifetime history. */
export async function collectCreatorTokenHistory({mint,creator,origin,read,previous=null,now=Date.now}={}){
 const result={currentWallet:null,transactions:[],status:'evidence_unavailable',additionalRequests:0,targetAddress:null,checkpoint:null,limitations:[]};
 let accounts=[];
 try{
  const response=await read('getTokenAccountsByOwner',[creator,{mint},{encoding:'jsonParsed',commitment:'finalized'}]);result.additionalRequests++;
  if(!Number.isSafeInteger(response?.context?.slot)||!Array.isArray(response.value)||response.value.length>1000)throw Error();
  let balance=0n;const seen=new Set();
  for(const row of response.value){const a=row?.account,i=a?.data?.parsed?.info;
   if(!address(row?.pubkey)||seen.has(row.pubkey)||a?.executable!==false||!PROGRAMS.has(a.owner)||a.data.parsed.type!=='account'||i?.mint!==mint||i.owner!==creator||!uint(i.tokenAmount?.amount))throw Error();
   balance+=BigInt(i.tokenAmount.amount);seen.add(row.pubkey);accounts.push({address:row.pubkey,amountRaw:i.tokenAmount.amount});
  }
  if(balance>18446744073709551615n)throw Error();
  result.currentWallet={rawBalance:balance.toString(),slot:response.context.slot,observedAt:new Date(now()).toISOString(),accountCount:accounts.length};
 }catch{result.limitations.push('Current token account inventory unavailable; historical creation-account evidence may still be inspected.');}
 const keys=origin?.tx?.transaction?.message?.accountKeys||[];
 const launchAccounts=(origin?.tx?.meta?.postTokenBalances||[]).filter(b=>b.mint===mint&&b.owner===creator).map(b=>key(keys[b.accountIndex])).filter(address);
 const targets=[...new Set([...launchAccounts,...accounts.sort((a,b)=>BigInt(a.amountRaw)>BigInt(b.amountRaw)?-1:1).map(a=>a.address)])];
 const previousToken=previous?.paginationToken??previous?.paginationKey;
 const compatible=previous?.version===1&&previous.mint===mint&&previous.creator===creator&&targets.includes(previous.targetAddress)&&typeof previousToken==='string'&&previousToken.length<=2048;
 // A creation token account is preferred even after closure. A resumable page
 // stays bound to the verified target rather than to unrelated wallet history.
 const target=compatible?previous.targetAddress:targets[0];
 if(!target){result.status='token_account_discovery_unavailable';result.limitations.push('No current or creation token account could be verified. Closed accounts outside the creation transaction remain undiscovered.');return result;}
 result.targetAddress=target;
 const options={transactionDetails:'full',sortOrder:'asc',limit:12,commitment:'finalized',encoding:'jsonParsed',maxSupportedTransactionVersion:1,filters:{status:'succeeded'},...(compatible?{paginationToken:previousToken}:{})};
 try{
  const page=await read('getTransactionsForAddress',[target,options]);result.additionalRequests++;
  const token=page?.paginationToken??page?.paginationKey??null;
  if(!Array.isArray(page?.data)||page.data.length>12||token!=null&&(typeof token!=='string'||token.length>2048))throw Error();
  const seen=new Set();
  for(const tx of page.data){const signature=tx?.transaction?.signatures?.[0];
   if(typeof signature!=='string'||seen.has(signature)||tx.meta?.err!==null||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<origin.proof.creationTime||tx.blockTime>Math.floor(now()/1000)||!tx.transaction.message.accountKeys.some(k=>key(k)===mint))continue;
   seen.add(signature);result.transactions.push(tx);
  }
  const next=token||null,hasCursor=Object.hasOwn(page,'paginationToken')||Object.hasOwn(page,'paginationKey'),hash=x=>createHash('sha256').update(x).digest('hex'),cursorHistory=compatible&&Array.isArray(previous.cursorHistory)?previous.cursorHistory.filter(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)).slice(-16):[];
  if(next&&(compatible&&next===previousToken||cursorHistory.includes(hash(next))))throw Error('PAGINATION_STALLED');
  result.status='bounded_token_history_assessed';result.candidateCount=page.data.length;result.paginationRemaining=!!next;
  result.checkpoint={version:1,mint,creator,targetAddress:target,paginationToken:next,addressWindowExhausted:hasCursor&&!next,cursorStatus:hasCursor?(next?'more_history_available':'explicit_address_window_end'):'pagination_metadata_missing',cursorHistory:[...cursorHistory,...(compatible?[hash(previousToken)]:[])].slice(-16),pagesAssessed:(compatible&&Number.isSafeInteger(previous.pagesAssessed)?previous.pagesAssessed:0)+1,historyComplete:false};
  result.limitations.push('Only the verified target token account has been paged. Other current/closed token accounts and unrelated acquisition mechanisms may remain unobserved.');
 }catch{result.status='targeted_history_unavailable';result.limitations.push('Token-specific indexed history unavailable, malformed, or stalled; no historical inactivity conclusion.');}
 return result;
}
/** Reuse only bounded successful finalized transaction-shaped receipts. No
 * endpoint/credential material is stored. Identity and mint binding are rechecked. */
export function reusableCreatorTransactions(observation,mint,creator){
 if(observation?.mint!==mint||observation.creator?.creator!==creator||!Array.isArray(observation.transactionCache))return [];
 return observation.transactionCache.slice(0,4).filter(tx=>{try{return ['legacy',0,1].includes(tx.version)&&tx.meta?.err===null&&Number.isSafeInteger(tx.slot)&&Number.isSafeInteger(tx.blockTime)&&typeof tx.transaction?.signatures?.[0]==='string'&&tx.transaction.message.accountKeys.some(k=>key(k)===mint)&&Buffer.byteLength(JSON.stringify(tx))<=24000;}catch{return false;}});
}
export function cacheCreatorTransactions(transactions,mint,creationSignature=null){
 const values=[...transactions.values()];if(creationSignature){const origin=values.find(tx=>tx.transaction?.signatures?.[0]===creationSignature);if(origin)values.splice(values.indexOf(origin),1),values.unshift(origin);}
 let bytes=0;const eligible=values.filter(tx=>{const n=Buffer.byteLength(JSON.stringify(tx));if(n>24000||bytes+n>96000||!tx.transaction.message.accountKeys.some(k=>key(k)===mint))return false;bytes+=n;return true;});return creationSignature&&eligible[0]?.transaction?.signatures?.[0]===creationSignature?[eligible[0],...eligible.slice(1).slice(-3)]:eligible.slice(-4);
}

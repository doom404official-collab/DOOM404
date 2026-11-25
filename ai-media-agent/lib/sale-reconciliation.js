'use strict';
const {decodePump}=require('./protocol-evidence');
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',TOKEN22='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',SYSTEM='11111111111111111111111111111111',WSOL='So11111111111111111111111111111111111111112';
const isToken=x=>[TOKEN,TOKEN22].includes(x?.programId);
const raw=x=>{const v=String(x?.parsed?.info?.tokenAmount?.amount??x?.parsed?.info?.amount??'');return /^\d+$/.test(v)?BigInt(v):null};
function context(t){
 const msg=t.transaction.message,keys=msg.accountKeys.map(k=>typeof k==='string'?k:k.pubkey),pre=t.meta.preTokenBalances||[],post=t.meta.postTokenBalances||[];
 const flat=[];for(let i=0;i<msg.instructions.length;i++){flat.push({...msg.instructions[i],outerIndex:i,depth:1});for(const x of t.meta.innerInstructions?.find(g=>g.index===i)?.instructions||[])flat.push({...x,outerIndex:i,depth:x.stackHeight});}
 const rows=a=>[...pre,...post].filter(b=>keys[b.accountIndex]===a);
 const owner=(a,o,m)=>{const r=rows(a);return r.length>0&&r.every(b=>b.owner===o&&b.mint===m)};
 const delta=a=>{const i=keys.indexOf(a);return BigInt(post.find(b=>b.accountIndex===i)?.uiTokenAmount.amount||'0')-BigInt(pre.find(b=>b.accountIndex===i)?.uiTokenAmount.amount||'0')};
 const native=(a,side)=>{const v=t.meta[side+'Balances']?.[keys.indexOf(a)];return Number.isSafeInteger(v)?BigInt(v):null};
 return {msg,keys,pre,post,flat,rows,owner,delta,native};
}
// Conservative whole-transaction native ledger. Reject unknown native mutations;
// closures are valued from starting lamports and explicit rent/proceeds movements.
function nativeLedger(t,c,implicit=[]){
 const changes=new Map(),add=(a,n)=>changes.set(a,(changes.get(a)||0n)+n),moves=new Map(),move=(a,b,n)=>{add(a,-n);add(b,n);moves.set(a,(moves.get(a)||0n)-n);moves.set(b,(moves.get(b)||0n)+n)};
 add(c.keys[0],-BigInt(t.meta.fee));
 for(const [a,b,n] of implicit)move(a,b,n);
 for(const x of c.flat){const d=x.parsed?.info||{},type=x.parsed?.type;
  if(x.programId===SYSTEM&&['transfer','createAccount','createAccountWithSeed','transferWithSeed'].includes(type)){
   if(!Number.isSafeInteger(d.lamports))return null;move(d.source,d.destination||d.newAccount,BigInt(d.lamports));
  }else if(isToken(x)&&['transfer','transferChecked'].includes(type)){
   const mint=d.mint||c.rows(d.source)[0]?.mint;if(mint===WSOL){const n=raw(x);if(n===null)return null;move(d.source,d.destination,n);}
  }else if(isToken(x)&&type==='closeAccount'){
   const start=c.native(d.account,'pre');if(start===null)return null;const n=start+(moves.get(d.account)||0n);if(n<0n)return null;move(d.account,d.destination,n);
  }
 }
 for(const [a,n] of changes){const pre=c.native(a,'pre'),post=c.native(a,'post');if(pre===null||post===null||post-pre!==n)return null;}
 return {changes,moves};
}
function temporaryQuote(t,c,account,seller,mint,outerIndex,gain){
 if(mint!==WSOL||c.rows(account).length||c.native(account,'pre')!==0n||c.native(account,'post')!==0n)return null;
 const init=c.flat.filter(x=>isToken(x)&&['initializeAccount','initializeAccount2','initializeAccount3'].includes(x.parsed?.type)&&x.parsed.info.account===account);
 const close=c.flat.filter(x=>isToken(x)&&x.parsed?.type==='closeAccount'&&x.parsed.info.account===account);
 const creates=c.flat.filter(x=>x.programId===SYSTEM&&['createAccount','createAccountWithSeed'].includes(x.parsed?.type)&&x.parsed.info.newAccount===account);
 if(init.length!==1||close.length!==1||creates.length!==1)return null;
 const a=init[0],z=close[0],d=a.parsed.info,zd=z.parsed.info,cr=creates[0].parsed.info;
 if(a.programId!==TOKEN||z.programId!==TOKEN||d.mint!==WSOL||d.owner!==seller||zd.owner!==seller||zd.destination!==seller||cr.owner!==TOKEN||creates[0].outerIndex>=outerIndex||a.outerIndex>=outerIndex||z.outerIndex<=outerIndex)return null;
 if(c.flat.some(x=>isToken(x)&&x.parsed?.info?.account===account&&['setAuthority','syncNative'].includes(x.parsed?.type)))return null;
 const moves=c.flat.filter(x=>isToken(x)&&['transfer','transferChecked'].includes(x.parsed?.type)&&(x.parsed.info.source===account||x.parsed.info.destination===account));
 if(moves.length!==1||moves[0].parsed.info.destination!==account||raw(moves[0])!==gain)return null;
 if(!nativeLedger(t,c))return null;
 return {type:'TEMPORARY_WSOL_NATIVE_SETTLEMENT',account,rentLamports:String(cr.lamports),proceedsLamports:gain.toString(),closureRecipient:seller,syncNativeObserved:false,transactionFeeLamports:String(t.meta.fee),nativeBalanceReconciled:true};
}
function reconcileSales(t,mint,{seller,signature}={}){
 const results=[],diagnostics=[];if(!t||t.meta?.err!==null)return {results,diagnostics,status:'TRANSACTION_UNAVAILABLE'};
 const c=context(t);
 const calls=[];for(let i=0;i<c.msg.instructions.length;i++){
 const inner=t.meta.innerInstructions?.find(g=>g.index===i)?.instructions||[];
 calls.push({i,ix:c.msg.instructions[i],depth:1,inner});
 for(let k=0;k<inner.length;k++){const x=inner[k];if(!Number.isInteger(x.stackHeight))continue;let end=k+1;while(end<inner.length&&inner[end].stackHeight>x.stackHeight)end++;calls.push({i,ix:x,depth:x.stackHeight,inner:inner.slice(k+1,end),innerIndex:k});}
 }
 for(const call of calls){const {i,depth,inner}=call;
  const d=decodePump(call.ix);if(!d)continue;
  const row={outerIndex:i,...(call.innerIndex===undefined?{}:{innerIndex:call.innerIndex}),protocol:d.protocol,instruction:d.instruction,seller:d.roles?.wallet||null,exactMint:d.accountRoles?.base_mint===mint,rejection:null};diagnostics.push(row);
  if(d.protocol==='Pump.fun bonding curve'&&['sell','sell_v2','sell_v3'].includes(d.instruction)&&d.layoutStatus==='OFFICIAL_ACCOUNT_LAYOUT'){
   const result=require('./curve-sale-evidence').curveSale(t,c,call,d,mint,seller,signature);
   if(result.evidence)results.push(result.evidence);else row.rejection=result.rejection;continue;
  }
  if(d.protocol!=='PumpSwap'||d.instruction!=='sell'||d.layoutStatus!=='OFFICIAL_ACCOUNT_LAYOUT'){row.rejection='UNSUPPORTED_SELL_OR_LAYOUT';continue;}
  const a=d.accountRoles;row.exactMint=a.base_mint===mint;
  const reject=reason=>{row.rejection=reason};
  if(a.base_mint!==mint||![WSOL,'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'].includes(a.quote_mint)){reject('MINT_OR_QUOTE_MISMATCH');continue;}
  if(seller&&a.user!==seller){reject('SELLER_MISMATCH');continue;}
  if(!c.msg.accountKeys.some(k=>typeof k==='object'&&k.pubkey===a.user&&k.signer)){reject('SELLER_SIGNATURE_MISSING');continue;}
  if(!c.owner(a.user_base_token_account,a.user,mint)||!c.owner(a.pool_base_token_account,a.pool,mint)||!c.owner(a.pool_quote_token_account,a.pool,a.quote_mint)){reject('ACCOUNT_OWNERSHIP_OR_MINT_MISMATCH');continue;}
  const amount=(source,destination,token,authority)=>inner.filter(x=>x.stackHeight===depth+1&&isToken(x)&&['transfer','transferChecked'].includes(x.parsed?.type)&&x.parsed.info.source===source&&x.parsed.info.destination===destination&&x.parsed.info.authority===authority&&(!x.parsed.info.mint||x.parsed.info.mint===token)).reduce((n,x)=>n+(raw(x)||0n),0n);
  const out=amount(a.user_base_token_account,a.pool_base_token_account,mint,a.user),gain=amount(a.pool_quote_token_account,a.user_quote_token_account,a.quote_mint,a.pool);
  Object.assign(row,{tokenOutRaw:out.toString(),quoteProceedsRaw:gain.toString()});
  if(out<=0n||out.toString()!==d.rawInstructionAmount||c.delta(a.user_base_token_account)!==-out){reject('TOKEN_OUTFLOW_UNRECONCILED');continue;}
  if(gain<=0n){reject('QUOTE_PROCEEDS_MISSING');continue;}
  let settlement;
  if(c.owner(a.user_quote_token_account,a.user,a.quote_mint)&&c.delta(a.user_quote_token_account)===gain)settlement={type:'TOKEN_ACCOUNT_CREDIT'};
  else settlement=temporaryQuote(t,c,a.user_quote_token_account,a.user,a.quote_mint,i,gain);
  if(!settlement){reject('QUOTE_ACCOUNT_OR_SETTLEMENT_UNRECONCILED');continue;}
  const poolQuoteDelta=c.delta(a.pool_quote_token_account);
  const paid=inner.filter(x=>x.stackHeight===depth+1&&isToken(x)&&['transfer','transferChecked'].includes(x.parsed?.type)&&x.parsed.info.source===a.pool_quote_token_account&&x.parsed.info.authority===a.pool&&(!x.parsed.info.mint||x.parsed.info.mint===a.quote_mint)).reduce((n,x)=>n+(raw(x)||0n),0n);
  if(poolQuoteDelta!==-paid||c.delta(a.pool_base_token_account)!==out){reject('POOL_BALANCE_UNRECONCILED');continue;}
  results.push({instruction:'sell',protocol:d.protocol,seller:a.user,mint,tokenOutRaw:out.toString(),quoteMint:a.quote_mint,quoteProceedsRaw:gain.toString(),outerIndex:i,...(call.innerIndex===undefined?{}:{innerIndex:call.innerIndex}),settlement,source:d.source,...(signature?{signature,slot:t.slot,url:'https://solscan.io/tx/'+signature}:{})});
 }
 return {results,diagnostics,status:results.length?'SALE_RECONCILED':'NO_EXACT_SALE_MATCH'};
}
module.exports={reconcileSales,context,nativeLedger,TOKEN,TOKEN22,WSOL,isToken,raw};

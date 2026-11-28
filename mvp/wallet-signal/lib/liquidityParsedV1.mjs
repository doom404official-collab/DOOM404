// Parsed JSON only. Agave c31ad74dc068e59acf7d5b5a14835ef9a52ec35b:
// transaction-status/src/lib.rs encode_with_meta and v1::Message::encode;
// transaction-status-client-types/src/lib.rs UiTransactionConfig.
// This validates shape, not provider provenance, signatures or authorization.
const PUMP_AMM_PROGRAM='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
// spl-memo-interface 2.1.0, pinned by the Agave Cargo.lock above.
const MEMO_PROGRAMS=new Set([
 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
 'Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH'
]);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const dense=x=>Array.isArray(x)&&Array.from({length:x.length},(_,i)=>Object.hasOwn(x,i)).every(Boolean);
// Keep pure decoder consumers dependency-free (some offline workflows do not
// install the SDK). Canonical base58 representation of exactly 32 bytes only.
const key=x=>{
 if(typeof x!=='string'||x.length<32||x.length>44)return false;
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;
 for(const c of x){const digit=alphabet.indexOf(c);if(digit<0)return false;n=n*58n+BigInt(digit);}
 let bytes=0;while(n){bytes++;n>>=8n;}
 const zeros=x.match(/^1*/)[0].length;
 return zeros+bytes===32;
};
const uint=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
export function validParsedLiquidityV1(tx){
 if(tx?.version!==1)return false;
 const m=tx.transaction?.message,c=m?.transactionConfig,keys=m?.accountKeys;
 if(!object(m)||!object(c)||!dense(keys)||!keys.length||!key(m.recentBlockhash)||
  Object.hasOwn(m,'addressTableLookups')||Object.hasOwn(m,'staticAccountKeys')||Object.hasOwn(m,'header'))return false;
 const fields=['priorityFee','computeUnitLimit','loadedAccountsDataSizeLimit','heapSize'];
 if(Object.keys(c).length!==fields.length||fields.some(f=>!Object.hasOwn(c,f)||c[f]!==null&&!uint(c[f],f==='priorityFee'?Number.MAX_SAFE_INTEGER:4294967295)))return false;
 // jsonParsed omits loadedAddresses; tolerate only explicitly empty metadata.
 if(Object.hasOwn(tx.meta??{},'loadedAddresses')){
  const a=tx.meta.loadedAddresses;
  if(!object(a)||Object.keys(a).length!==2||!dense(a.writable)||!dense(a.readonly)||a.writable.length||a.readonly.length)return false;
 }
 if(keys.some(k=>!object(k)||!key(k.pubkey)||typeof k.signer!=='boolean'||typeof k.writable!=='boolean'||k.source!=='transaction')||new Set(keys.map(k=>k.pubkey)).size!==keys.length)return false;
 const signatures=tx.transaction.signatures;
 if(!dense(signatures)||!signatures.length||keys.filter(k=>k.signer).length!==signatures.length||keys.some((k,i)=>k.signer!==(i<signatures.length)))return false;
 const addresses=new Set(keys.map(k=>k.pubkey)),outer=m.instructions,inner=tx.meta?.innerInstructions;
 if(!dense(outer)||!dense(inner))return false;
 const validInstruction=(ix,nested)=>{
  if(!object(ix)||!addresses.has(ix.programId)||!uint(ix.stackHeight,4294967295)||(nested?ix.stackHeight<2:ix.stackHeight!==1)||Object.hasOwn(ix,'programIdIndex')||Object.hasOwn(ix,'accountKeyIndexes'))return false;
  // Pinned Agave has no PumpSwap parser: require its lossless partially decoded form.
  if(Object.hasOwn(ix,'parsed')){
   if(ix.programId===PUMP_AMM_PROGRAM||Object.hasOwn(ix,'data')||Object.hasOwn(ix,'accounts'))return false;
   if(MEMO_PROGRAMS.has(ix.programId)||ix.program==='spl-memo'||typeof ix.parsed==='string')
    return MEMO_PROGRAMS.has(ix.programId)&&ix.program==='spl-memo'&&typeof ix.parsed==='string';
   return object(ix.parsed);
  }
  return dense(ix.accounts)&&ix.accounts.every(a=>addresses.has(a))&&typeof ix.data==='string'&&/^[1-9A-HJ-NP-Za-km-z]*$/.test(ix.data);
 };
 const positions=new Set();
 return outer.every(ix=>validInstruction(ix,false))&&inner.every(g=>{
  if(!object(g)||!uint(g.index,outer.length-1)||positions.has(g.index)||!dense(g.instructions))return false;
  positions.add(g.index);let previousHeight=1;
  // Complete chronological CPI traces start at 2 and can descend by only one
  // frame per invocation; returns may unwind several frames. This cannot detect
  // an entirely omitted group or certify provider trace completeness.
  return g.instructions.every(ix=>{
   if(!validInstruction(ix,true)||ix.stackHeight>previousHeight+1)return false;
   previousHeight=ix.stackHeight;return true;
  });
 });
}

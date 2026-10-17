/** Bounded creator-wallet historical signature discovery.
 * Returns unclassified signatures, not sales or proof of complete archive coverage.
 */
export async function discoverCreatorWalletHistory({creator,rpc,before=null,maxPages=3,maxSignatures=300}={}){
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator||''))throw Error('INVALID_CREATOR_WALLET');
 if(typeof rpc?.lookupSignaturePage!=='function'||!Number.isInteger(maxPages)||maxPages<1||maxPages>10||!Number.isInteger(maxSignatures)||maxSignatures<1||maxSignatures>1000)throw Error('INVALID_HISTORY_OPTIONS');
 const signatures=[];let cursor=before,pages=0,exhausted=false;
 for(let i=0;i<maxPages&&signatures.length<maxSignatures;i++){
  const batch=await rpc.lookupSignaturePage(creator,{before:cursor});
  if(!Array.isArray(batch?.entries))throw Error('INVALID_SIGNATURE_PAGE');
  pages++;
  if(batch.entries.length===0){exhausted=Boolean(batch.exhausted);break;}
  let last=null;
  for(const entry of batch.entries){
   if(!entry||typeof entry.signature!=='string')throw Error('INVALID_SIGNATURE_ENTRY');
   if(signatures.length>=maxSignatures)break;
   last=entry.signature;
   if(entry.err==null)signatures.push(entry.signature);
  }
  if(!last||last===cursor)throw Error('PAGINATION_STALLED');
  cursor=last;
  if(batch.exhausted===true&&last===batch.entries.at(-1)?.signature){exhausted=true;break;}
 }
 return {creator,signatures:[...new Set(signatures)],nextCursor:cursor,pagesFetched:pages,rpcHistoryExhausted:exhausted,historyComplete:false,
  classification:'UNCLASSIFIED_TRANSACTIONS',verifiedSales:[],salesInferred:false};
}

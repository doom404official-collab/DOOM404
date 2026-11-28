/** Review stored launchpad creator evidence independently of token purchases.
 * This verifies internal evidence consistency, not beneficial ownership.
 */
export function reviewCreatorAttribution({mint,evidence=[]}={}){
 const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 if(!address.test(mint||'')||!Array.isArray(evidence))throw Error('INVALID_ATTRIBUTION_REVIEW');
 const records=evidence.filter(x=>address.test(x?.creator||'')&&typeof x.signature==='string'&&
 /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(x.signature)&&
 x.programId==='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'&&
 typeof x.decoderVersion==='string'&&x.decoderVersion.startsWith('pump-fun-'));
 const creators=[...new Set(records.map(x=>x.creator))];
 return {status:creators.length>1?'CONFLICTING_CREATOR_EVIDENCE':creators.length===1?'ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW':'UNRESOLVED',
  creator:creators.length===1?creators[0]:null,
  evidenceCount:records.length,signatures:[...new Set(records.map(x=>x.signature))],
  purchaseRequired:false,beneficialOwnerVerified:false,
  independentTransactionRecheckComplete:false};
}

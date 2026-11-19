import { summarizeCreatorHoldings } from './creatorHoldings.js';
/** Observed creator-wallet balance only. Does not infer beneficial ownership or historical sales. */
export async function investigateCreatorHoldings({mint,creator,rpc}={}){
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint||'')||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creator||''))throw Error('INVALID_CREATOR_IDENTITY');
 if(typeof rpc?.getTokenSupply!=='function'||typeof rpc?.getTokenAccountsByOwner!=='function')throw Error('MISSING_RPC_ADAPTER');
 const [supplyResult,accountResult]=await Promise.all([rpc.getTokenSupply(mint),rpc.getTokenAccountsByOwner(creator,mint)]);
 if(!supplyResult?.value||!Array.isArray(accountResult?.value))throw Error('HOLDINGS_EVIDENCE_INCOMPLETE');
 const tokenAccounts=accountResult.value.map(item=>({...item,pubkey:{toBase58:()=>item.pubkey}}));
 const holdings=summarizeCreatorHoldings({mint,creator,tokenAccounts,supply:supplyResult.value});
 return {...holdings,balanceObservedAt:new Date().toISOString(),creatorAttributionScope:'verified_launchpad_creator_wallet_only',
  linkedWalletsAssessed:false,historicalSalesAssessed:false,holdingsScoreEligible:false};
}

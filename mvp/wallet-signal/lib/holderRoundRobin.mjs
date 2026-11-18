/** Stable round-robin ordering across checkpoint resumes. */
export function nextHolderScanOrder(checkpoint){
 const wallets=Object.keys(checkpoint?.wallets||{});
 if(!wallets.length)return [];
 const index=Number.isInteger(checkpoint.nextWalletIndex)&&checkpoint.nextWalletIndex>=0?
  checkpoint.nextWalletIndex%wallets.length:0;
 return [...wallets.slice(index),...wallets.slice(0,index)].filter(w=>!checkpoint.wallets[w].exhausted);
}
export function advanceHolderScanCursor(checkpoint,wallet){
 const wallets=Object.keys(checkpoint?.wallets||{});
 const index=wallets.indexOf(wallet);
 if(index<0)throw Error("UNKNOWN_HOLDER_WALLET");
 checkpoint.nextWalletIndex=(index+1)%wallets.length;
 return checkpoint;
}
export function holderScanCoverage(checkpoint){
 const wallets=Object.entries(checkpoint?.wallets||{});
 return {walletsTotal:wallets.length,
  walletsWithPages:wallets.filter(([,s])=>s.pages>0).length,
  walletsProviderExhausted:wallets.filter(([,s])=>s.exhausted).length,
  perWallet:wallets.map(([wallet,s])=>({wallet,pages:s.pages,signaturesSeen:s.signaturesSeen,providerExhausted:s.exhausted,
   pageReplayCoverage:s.pageReplay?"bounded_recent_cursors_only":"legacy_unverified",
   pageReplayHistoryVerified:false,pageReplayStalled:Boolean(s.pageReplay?.stalledCursor),recentPageCursorCount:Array.isArray(s.pageReplay?.cursors)?s.pageReplay.cursors.length:0})),
  nextWalletIndex:checkpoint.nextWalletIndex??0,
  archivalCompletenessProven:false};
}

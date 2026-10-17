/** Snapshot-only evidence adapter. Historical connections are observations, never proof of full history. */
export function summarizeHistoricalHolderPreview({historical,compatible=false}={}){
 if(!historical||!Array.isArray(historical.holders))return {available:false,compatible:false,holderCount:0,directPairs:null,connectedWallets:null,historyComplete:false};
 const directPairs=Number(historical.directPairs);
 const connectedWallets=Number(historical.connectedWallets);
 return {available:true,compatible:compatible===true,holderCount:historical.holders.length,
  directPairs:Number.isFinite(directPairs)&&directPairs>=0?directPairs:null,
  connectedWallets:Number.isFinite(connectedWallets)&&connectedWallets>=0?connectedWallets:null,
  historyComplete:historical.historyComplete===true,
  note:compatible?"Historical holder snapshot matches current ownership mapping. Connections remain observed evidence.":"Historical snapshot differs from live holder set; show separately and never combine its connections with current balances."};
}

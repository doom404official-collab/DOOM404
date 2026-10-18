// LP holder balances alone do not prove custody, locks, burns, or redemption safety.
export function summarizeLpHolders(rows, mintSupply, complete = false) {
 if (!Array.isArray(rows) || !/^[0-9]+$/.test(String(mintSupply))) throw Error("INVALID_LP_HOLDER_INPUT");
 const entries = rows.filter(x => typeof x?.owner === "string" && /^[0-9]+$/.test(String(x.amount)));
 const observed = entries.reduce((sum,x) => sum + BigInt(x.amount),0n);
 const supply = BigInt(mintSupply);
 return {
  holderAccounts:entries.map(x=>({owner:x.owner,rawAmount:String(x.amount)})),
  observedRawAmount:observed.toString(),
  mintRawSupply:supply.toString(),
  inventoryComplete:complete,
  supplyReconciled:complete && observed===supply,
  lpCustodyVerified:false,
  lpLockVerified:false,
  lpBurnVerified:false,
  withdrawalRightsVerified:false
 };
}

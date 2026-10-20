// LP holder balances alone do not prove custody, locks, burns, or redemption safety.
const raw = value => typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value);
export function summarizeLpHolders(rows, mintSupply, complete = false) {
 if (!Array.isArray(rows) || !raw(mintSupply)) throw Error("INVALID_LP_HOLDER_INPUT");
 const seen = new Set();
 let invalidRows = 0, duplicateAccounts = 0, missingAccountIdentities = 0;
 const entries = rows.filter(x => {
  if (typeof x?.owner !== "string" || !x.owner || !raw(x.amount)) { invalidRows++; return false; }
  if (typeof x.tokenAccount !== "string" || !x.tokenAccount) missingAccountIdentities++;
  else if (seen.has(x.tokenAccount)) { duplicateAccounts++; return false; }
  else seen.add(x.tokenAccount);
  return true;
 });
 const observed = entries.reduce((sum,x) => sum + BigInt(x.amount),0n);
 const supply = BigInt(mintSupply);
 const inventoryComplete = complete === true && invalidRows === 0 && duplicateAccounts === 0 && missingAccountIdentities === 0;
 return {
  holderAccounts:entries.map(x=>({...(x.tokenAccount ? {tokenAccount:x.tokenAccount} : {}),owner:x.owner,rawAmount:x.amount})),
  observedRawAmount:observed.toString(),
  mintRawSupply:supply.toString(),
  inventoryComplete,
  supplyReconciled:inventoryComplete && observed===supply,
  invalidRows, duplicateAccounts, missingAccountIdentities,
  lpCustodyVerified:false,
  lpLockVerified:false,
  lpBurnVerified:false,
  withdrawalRightsVerified:false
 };
}

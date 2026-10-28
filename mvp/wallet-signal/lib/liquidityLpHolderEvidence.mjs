// LP holder balances alone do not prove custody, locks, burns, or redemption safety.
const raw = value => typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) && value.length<=20 && BigInt(value)<=18446744073709551615n;
export function summarizeLpHolders(rows, mintSupply, complete = false) {
 if (!Array.isArray(rows) || !raw(mintSupply)) throw Error("INVALID_LP_HOLDER_INPUT");
 const seen = new Map(), conflicts = new Set();
 let invalidRows = 0, duplicateAccounts = 0, missingAccountIdentities = 0;
 const entries = rows.filter(x => {
  if (typeof x?.owner !== "string" || !x.owner || !raw(x.amount)) { invalidRows++; return false; }
  if (typeof x.tokenAccount !== "string" || !x.tokenAccount) missingAccountIdentities++;
  else if (seen.has(x.tokenAccount)) { duplicateAccounts++; const prior=seen.get(x.tokenAccount); if(prior.owner!==x.owner||prior.amount!==x.amount)conflicts.add(x.tokenAccount); return false; }
  else seen.set(x.tokenAccount,x);
  return true;
 });
 const retained=entries.filter(x=>!conflicts.has(x.tokenAccount));
 const observed = retained.reduce((sum,x) => sum + BigInt(x.amount),0n);
 const supply = BigInt(mintSupply);
 const inventoryComplete = complete === true && invalidRows === 0 && duplicateAccounts === 0 && missingAccountIdentities === 0 && conflicts.size===0 && observed<=supply;
 return {
  holderAccounts:retained.map(x=>({...(x.tokenAccount ? {tokenAccount:x.tokenAccount} : {}),owner:x.owner,rawAmount:x.amount})),
  observedRawAmount:conflicts.size?null:observed.toString(),
  conflictingAccounts:conflicts.size,
  observedExceedsSupply:observed>supply,
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

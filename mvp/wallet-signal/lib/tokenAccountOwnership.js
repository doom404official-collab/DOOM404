/** Distinguish token accounts from their controlling token-account owner.
 * An owner address alone does not establish beneficial ownership or whether
 * the account belongs to an exchange, liquidity pool, or custody service.
 */
export function summarizeResolvedTokenAccounts(accounts, parsedAccounts){
 const rows=accounts.map((account,i)=>{
  const parsed=parsedAccounts[i]?.value?.data?.parsed;
  const info=parsed?.type==="account"?parsed.info:null;
  const owner=typeof info?.owner==="string"?info.owner:null;
  return {...account,ownerWallet:owner,ownerResolved:Boolean(owner),
   accountCategory:"UNCLASSIFIED",classificationEvidence:owner?"SPL_TOKEN_ACCOUNT_OWNER":"NONE"};
 });
 const groups=new Map();
 for(const row of rows){
  if(!row.ownerWallet)continue;
  const g=groups.get(row.ownerWallet)||{ownerWallet:row.ownerWallet,tokenAccountCount:0,sharePct:0};
  g.tokenAccountCount++;
  g.sharePct+=Number(row.sharePct||0);
  groups.set(row.ownerWallet,g);
 }
 return {accounts:rows,observedOwnerGroups:[...groups.values()].sort((a,b)=>b.sharePct-a.sharePct),
  resolvedAccountCount:rows.filter(x=>x.ownerResolved).length,
  ownerCoverageComplete:false,beneficialOwnersVerified:false,
  warning:"Only sampled token accounts are grouped by SPL owner. Pool, custody and beneficial ownership remain unclassified."};
}

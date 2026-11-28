import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
/** Offline recovery validation; no provider reads and no score promotion. */
export function validateCanonicalHolderBaseline(artifact){
 const {snapshot:s,inventory}=artifact??{};const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 assert.equal(s.schemaVersion,2);new PublicKey(s.mint);assert.equal(s.commitment,'finalized');assert.equal(s.atomic,false);
 assert(Number.isFinite(Date.parse(s.observedAt)));assert(Object.values(s.contextSlots).every(x=>Number.isSafeInteger(x)&&x>=0));
 assert.equal(s.hashAlgorithm,'sha256-ordered-eligible-wallet-token-accounts-v2');assert.equal(s.supplyDefinition,'mint-total-supply-not-circulating');
 assert.equal(s.historyComplete,false);assert.equal(s.commonOwnershipEstablished,false);assert.equal(s.custodialClassificationComplete,false);
 assert.equal(hash(inventory),s.inventoryDigest);assert.equal(inventory.length,s.inventoryWalletCount);
 const accounts=new Set(),wallets=new Set();let total=0n;
 for(let i=0;i<inventory.length;i++){
  const w=inventory[i];new PublicKey(w.wallet);assert(!wallets.has(w.wallet));wallets.add(w.wallet);
  assert(/^[1-9][0-9]*$/.test(w.balance));let balance=0n;
  for(const t of w.tokenAccounts){new PublicKey(t.tokenAccount);assert(!accounts.has(t.tokenAccount));accounts.add(t.tokenAccount);assert(/^(0|[1-9][0-9]*)$/.test(t.amountRaw));balance+=BigInt(t.amountRaw);}
  assert.equal(balance.toString(),w.balance);total+=balance;
  if(i){const p=inventory[i-1];assert(BigInt(p.balance)>balance||BigInt(p.balance)===balance&&p.wallet<w.wallet);}
 }
 assert.equal(total.toString(),s.supplyRaw);assert(accounts.size<=s.inventoryAccountCount);
 assert.equal(s.eligibleHolders.length,20);const excluded=new Set(s.excludedWallets.map(w=>w.wallet));assert.equal(excluded.size,s.excludedWallets.length);
 let index=0;for(const w of inventory){if(excluded.has(w.wallet))continue;const h=s.eligibleHolders[index];assert.equal(w.wallet,h.wallet);assert.equal(w.balance,h.balance);assert.deepEqual(w.tokenAccounts,h.tokenAccounts);assert.equal(h.rank,index+1);assert(PublicKey.isOnCurve(new PublicKey(h.wallet).toBytes()));assert(h.authorityAccount.programOwner===null||h.authorityAccount.programOwner==='11111111111111111111111111111111');if(++index===20)break;}
 assert.equal(hash({version:2,mint:s.mint,holders:s.eligibleHolders.map(h=>[h.wallet,h.tokenAccounts.map(t=>t.tokenAccount)])}),s.holderSetHash);
 return {valid:true,retainedAccounts:accounts.size,zeroOnlyAccountsOmitted:s.inventoryAccountCount-accounts.size,top20Raw:s.eligibleHolders.reduce((n,h)=>n+BigInt(h.balance),0n).toString()};
}
if(process.argv[1]?.endsWith('validate-canonical-holder-baseline.mjs'))console.log(JSON.stringify(validateCanonicalHolderBaseline(JSON.parse(readFileSync(process.argv[2],'utf8')))));

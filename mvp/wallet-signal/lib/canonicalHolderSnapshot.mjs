import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
const TOKEN='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',SYSTEM='11111111111111111111111111111111';
const burn='1nc1nerator11111111111111111111111111111111';
const pool='6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA';
const raw=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
const slot=x=>Number.isSafeInteger(x)&&x>=0;
const compare=(a,b)=>a<b?-1:a>b?1:0;
/** Retain the standard account prefix, including account state and Token-2022
 * account-type byte. Extension payloads are not needed for holder balances. */
export function normalizeBinaryHolderInventory({mint,response}){
 if(!slot(response?.context?.slot)||!Array.isArray(response.value))throw Error('HOLDER_INVENTORY_UNAVAILABLE');
 return {context:response.context,value:response.value.map(row=>{
  const account=row?.account,data=account?.data;
  if(account?.owner!==TOKEN||account.executable!==false||!Array.isArray(data)||data[1]!=='base64'||typeof data[0]!=='string')throw Error('HOLDER_BINARY_ACCOUNT_INVALID');
  const bytes=Buffer.from(data[0],'base64');
  if(bytes.toString('base64')!==data[0]||![165,166].includes(bytes.length)||
   (bytes.length===166&&bytes[165]!==2)||![1,2].includes(bytes[108])||
   ![0,1].includes(bytes.readUInt32LE(72))||![0,1].includes(bytes.readUInt32LE(129))||
   new PublicKey(bytes.subarray(0,32)).toBase58()!==mint)throw Error('HOLDER_BINARY_ACCOUNT_INVALID');
  return {pubkey:row.pubkey,account:{owner:TOKEN,executable:false,prefixSha256:createHash('sha256').update(bytes).digest('hex'),
   data:{parsed:{type:'account',info:{mint,owner:new PublicKey(bytes.subarray(32,64)).toBase58(),
    tokenAmount:{amount:bytes.readBigUInt64LE(64).toString()}}}}}};
 })};
}
export function aggregateHolderInventory({mint,inventory}){
 if(!slot(inventory?.context?.slot)||!Array.isArray(inventory.value)||!inventory.value.length)throw Error('HOLDER_INVENTORY_UNAVAILABLE');
 const seen=new Set(),wallets=new Map();let total=0n;
 for(const row of inventory.value){
  const account=row?.account,info=account?.data?.parsed?.info;
  if(!row?.pubkey||seen.has(row.pubkey)||account.owner!==TOKEN||account.executable!==false||
   account.data.parsed.type!=='account'||info?.mint!==mint||!raw(info.tokenAmount?.amount)||typeof info.owner!=='string')throw Error('HOLDER_INVENTORY_INVALID');
  new PublicKey(row.pubkey);new PublicKey(info.owner);seen.add(row.pubkey);
  const amount=BigInt(info.tokenAmount.amount);total+=amount;
  if(!wallets.has(info.owner))wallets.set(info.owner,{wallet:info.owner,balance:0n,tokenAccounts:[]});
  const w=wallets.get(info.owner);w.balance+=amount;w.tokenAccounts.push({tokenAccount:row.pubkey,amountRaw:amount.toString(),...(account.prefixSha256?{prefixSha256:account.prefixSha256}:{})});
 }
 const ranking=[...wallets.values()].filter(w=>w.balance>0n).sort((a,b)=>a.balance===b.balance?compare(a.wallet,b.wallet):a.balance>b.balance?-1:1)
  .map(w=>({...w,balance:w.balance.toString(),tokenAccounts:w.tokenAccounts.sort((a,b)=>compare(a.tokenAccount,b.tokenAccount))}));
 return {ranking,totalRaw:total.toString(),accountCount:seen.size};
}
/** Full inventory observation plus explicitly separate mint/owner context slots.
 * This never describes a series of reads as an atomic Solana bank snapshot. */
export function buildCanonicalHolderSnapshot({mint,observedAt,mintResponse,inventory,ownerResponse,ownerAddresses,provider='helius'}){
 new PublicKey(mint);
 const m=mintResponse?.value,info=m?.data?.parsed?.info;
 if(!['helius','alchemy'].includes(provider)||!Number.isFinite(Date.parse(observedAt))||
  !slot(mintResponse?.context?.slot)||m.owner!==TOKEN||m.executable!==false||m.data?.parsed?.type!=='mint'||
  !raw(info?.supply)||BigInt(info.supply)===0n||!Number.isSafeInteger(info.decimals)||info.decimals<0||info.decimals>255)throw Error('MINT_OBSERVATION_INVALID');
 const a=aggregateHolderInventory({mint,inventory});
 if(a.totalRaw!==info.supply)throw Error('SUPPLY_INVENTORY_NOT_RECONCILED');
 if(!slot(ownerResponse?.context?.slot)||!Array.isArray(ownerAddresses)||!Array.isArray(ownerResponse.value)||
  ownerResponse.value.length!==ownerAddresses.length||new Set(ownerAddresses).size!==ownerAddresses.length)throw Error('OWNER_CLASSIFICATION_UNAVAILABLE');
 const owners=new Map(ownerAddresses.map((address,i)=>[address,ownerResponse.value[i]]));
 const eligible=[],excluded=[];
 for(const w of a.ranking){
  let reason=w.wallet===burn?'INCINERATOR':w.wallet===pool?'PUMP_AMM_POOL':null;
  const state=owners.get(w.wallet);
  if(!reason){
   if(!owners.has(w.wallet))throw Error('OWNER_CLASSIFICATION_UNAVAILABLE');
   if(state?.executable===true)reason='EXECUTABLE_PROGRAM';
   else if(state&&state.owner!==SYSTEM)reason='PROGRAM_OWNED_AUTHORITY';
   else if(!PublicKey.isOnCurve(new PublicKey(w.wallet).toBytes()))reason='PROGRAM_DERIVED_AUTHORITY';
  }
  const authorityAccount={programOwner:state?.owner??null,executable:state?.executable??null,contextSlot:ownerResponse.context.slot};
  if(reason){excluded.push({...w,reason,authorityAccount});continue;}
  eligible.push({...w,rank:eligible.length+1,classification:state?'SYSTEM_WALLET_CUSTODIAN_STATUS_UNRESOLVED':'ABSENT_ON_CURVE_AUTHORITY_CUSTODIAN_STATUS_UNRESOLVED',authorityAccount});
  if(eligible.length===20)break;
 }
 if(eligible.length!==20)throw Error('ELIGIBLE_HOLDER_SET_INCOMPLETE');
 const identity=JSON.stringify({version:2,mint,holders:eligible.map(w=>[w.wallet,w.tokenAccounts.map(t=>t.tokenAccount)])});
 const holderSetHash=createHash('sha256').update(identity).digest('hex');
 const inventoryDigest=createHash('sha256').update(JSON.stringify(a.ranking)).digest('hex');
 const contextSlots={inventory:inventory.context.slot,mint:mintResponse.context.slot,classifications:ownerResponse.context.slot};
 const snapshot={schemaVersion:2,mint,observedAt,commitment:'finalized',contextSlots,atomic:false,
  supplyRaw:info.supply,decimals:info.decimals,supplyDefinition:'mint-total-supply-not-circulating',
  holderSetHash,hashAlgorithm:'sha256-ordered-eligible-wallet-token-accounts-v2',provider,tokenProgram:TOKEN,
  providerProvenance:{provider,network:'solana-mainnet',methods:['getAccountInfo','getProgramAccounts','getMultipleAccounts'],requestCount:3},
  inventoryAccountCount:a.accountCount,inventoryWalletCount:a.ranking.length,inventoryDigest,
  supplyReconciled:true,eligibleHolders:eligible,excludedWallets:excluded,
  custodialClassificationComplete:false,commonOwnershipEstablished:false,historyComplete:false};
 return {snapshot,inventory:a.ranking};
}

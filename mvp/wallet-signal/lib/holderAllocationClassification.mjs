import {PublicKey} from '@solana/web3.js';
import {PUMP_PROGRAM_ID} from './pumpFunCreation.mjs';
const SYSTEM='11111111111111111111111111111111';
const TOKENS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const key=x=>typeof x==='string'?x:x?.toBase58?.();
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Retain every valid allocation. PDA derivation or account ownership alone never
 * establishes custody, vesting, treasury, withdrawal conditions or harmlessness. */
export function classifyHolderAllocations({mint,supplyRaw,accounts=[],ownerAccounts=new Map(),creator=null}={}){
 if(!uint(supplyRaw)||BigInt(supplyRaw)===0n)throw Error('INVALID_ALLOCATION_SUPPLY');
 const curve=PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'),new PublicKey(mint).toBuffer()],new PublicKey(PUMP_PROGRAM_ID))[0].toBase58();
 const rows=[],seen=new Set();let unresolvedRecords=0;
 for(const row of accounts){
  const a=row.account,info=a?.data?.parsed?.info,address=key(row.pubkey),program=key(a?.owner);
  if(!address||seen.has(address)||a?.executable!==false||!TOKENS.has(program)||a.data.parsed.type!=='account'||info?.mint!==mint||!uint(info.tokenAmount?.amount)||BigInt(info.tokenAmount.amount)>BigInt(supplyRaw)){unresolvedRecords++;continue;}
  seen.add(address);let onCurve;try{onCurve=PublicKey.isOnCurve(new PublicKey(info.owner).toBytes());}catch{unresolvedRecords++;continue;}
  const ownerKnown=ownerAccounts.has(info.owner),owner=ownerAccounts.get(info.owner);
  const plain=ownerKnown&&(owner===null||key(owner.owner)===SYSTEM&&owner.executable===false);
  const burn=info.owner==='1nc1nerator11111111111111111111111111111111';
  const bonding=info.owner===curve;
  const frozen=info.state==='frozen';
  const eligible=onCurve&&plain&&!burn&&!frozen;
  const classification=burn?'burn_account':bonding?'bonding_curve_account':frozen?'restricted_token_account':eligible?(info.owner===creator?'creator_wallet':'ordinary_wallet_account'):ownerKnown&&owner&&key(owner.owner)!==SYSTEM?'program_controlled_account':'unclassified_allocation';
  rows.push({tokenAccount:address,wallet:info.owner,amountRaw:info.tokenAmount.amount,sharePct:Number(BigInt(info.tokenAmount.amount)*1000000n/BigInt(supplyRaw))/10000,classification,eligible,
   authorityProgram:ownerKnown?key(owner?.owner)||null:null,classificationBasis:burn?'incinerator_address':bonding?'mint_bound_pump_bonding_curve_pda':frozen?'parsed_token_account_frozen_state':eligible?'on_curve_authority_and_observed_system_account':'economic_role_and_release_conditions_unverified',
   transferState:info.state||'unavailable',releaseConditionsVerified:false,beneficialOwnershipVerified:false,delegate:info.delegate||null,closeAuthority:info.closeAuthority||null,
   infrastructureVerified:bonding,withdrawalConditionsVerified:false});
 }
 const sum=rows.reduce((n,r)=>n+BigInt(r.amountRaw),0n);if(sum>BigInt(supplyRaw))throw Error('INVALID_ALLOCATION_SUM');
 const groups=new Map();for(const r of rows.filter(r=>r.eligible))groups.set(r.wallet,(groups.get(r.wallet)||0n)+BigInt(r.amountRaw));
 return {version:1,mint,supplyRaw,allocations:rows,unresolvedRecords,wallets:[...groups].map(([wallet,n])=>({wallet,amountRaw:n.toString()})),
  unclassifiedSharePct:rows.filter(r=>!r.eligible&&!r.infrastructureVerified&&r.classification!=='burn_account').reduce((n,r)=>n+r.sharePct,0),
  restrictedSharePct:rows.filter(r=>r.classification==='restricted_token_account').reduce((n,r)=>n+r.sharePct,0),
  scope:'Observed account roles only. Treasury, exchange custody, vesting and escrow require independently supported control and release evidence. Unknown allocations remain visible; no independence claim.'};
}

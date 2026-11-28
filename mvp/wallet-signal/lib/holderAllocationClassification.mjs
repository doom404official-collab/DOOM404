import {verifyAllocationPoolRole,verifyTokenMultisigControl,verifyProtocolSigningAuthority,allocationAccountBytes} from './allocationControlEvidence.mjs';
import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {PUMP_PROGRAM_ID} from './pumpFunCreation.mjs';
const SYSTEM='11111111111111111111111111111111';
const TOKENS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const key=x=>typeof x==='string'?x:x?.toBase58?.();
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
/** Retain every valid allocation. PDA derivation or account ownership alone never
 * establishes custody, vesting, treasury, withdrawal conditions or harmlessness. */
export function classifyHolderAllocations({mint,supplyRaw,accounts=[],ownerAccounts=new Map(),creator=null,mintInfo=null}={}){
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
  const ownerBytes=allocationAccountBytes(owner);
  const bondingVerified=bonding&&owner?.executable===false&&key(owner.owner)===PUMP_PROGRAM_ID&&ownerBytes?.length>=49&&ownerBytes.subarray(0,8).equals(createHash('sha256').update('account:BondingCurve').digest().subarray(0,8));
  const frozen=info.state==='frozen';
  const pool=verifyAllocationPoolRole({mint,tokenAccount:address,authority:info.owner,authorityAccount:owner});
  const multisig=verifyTokenMultisigControl(owner),protocolAuthority=verifyProtocolSigningAuthority(info.owner);
  const restrictions=Array.isArray(mintInfo?.extensions)?mintInfo.extensions.filter(e=>!['metadataPointer','tokenMetadata','transferFeeConfig'].includes(e?.extension||e?.type)):[];
  const transferControlScope=program==='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'?'classic_spl_account_state':Array.isArray(mintInfo?.extensions)&&restrictions.length===0?'supported_token_2022_mint_and_account_state':'mint_transfer_controls_unverified';
  const eligible=onCurve&&plain&&!burn&&!frozen&&!pool;
  const classification=burn?'burn_account':pool?'liquidity_pool_vault':multisig?'multisig_controlled_allocation':protocolAuthority?'protocol_authority_allocation':bonding?'bonding_curve_account':frozen?'restricted_token_account':eligible?(info.owner===creator?'creator_wallet':'ordinary_wallet_account'):ownerKnown&&owner&&key(owner.owner)!==SYSTEM?'program_controlled_account':'unclassified_allocation';
  rows.push({tokenAccount:address,wallet:info.owner,amountRaw:info.tokenAmount.amount,sharePct:Number(BigInt(info.tokenAmount.amount)*1000000n/BigInt(supplyRaw))/10000,classification,eligible,
   authorityProgram:ownerKnown?key(owner?.owner)||null:null,classificationBasis:burn?'incinerator_address':pool?pool.classificationBasis:multisig?'parsed_spl_multisig_threshold_and_signers':protocolAuthority?protocolAuthority.classificationBasis:bonding?'mint_bound_pump_bonding_curve_pda':frozen?'parsed_token_account_frozen_state':eligible?'on_curve_authority_and_observed_system_account':'economic_role_and_release_conditions_unverified',
   transferState:info.state||'unavailable',releaseConditionsVerified:false,beneficialOwnershipVerified:false,delegate:info.delegate||null,delegatedAmountRaw:info.delegatedAmount?.amount||null,closeAuthority:info.closeAuthority||null,
   infrastructureVerified:bondingVerified||!!pool,withdrawalConditionsVerified:false,protocol:pool?.protocol||protocolAuthority?.protocol||null,controlEvidence:multisig||pool||protocolAuthority||(key(owner?.owner)==='magnaSHyv8zzKJJmr8NSz5JXmtdGDTTFPEADmvNAwbj'?{kind:'published_allocation_program',programName:'Magna',programId:key(owner.owner),deploymentReference:'https://docs.magna.so/admins/privacy-and-security/magna-contract-deployments',releaseConditionsVerified:false,scope:'Published program deployment matched to observed account owner. This does not verify this allocation’s vesting schedule, withdrawal authority or administrator overrides.'}:null),transferControlScope,unrestrictedOwnerControlObserved:eligible&&info.state==='initialized'&&transferControlScope!=='mint_transfer_controls_unverified',economicRoleVerified:false});
 }
 const sum=rows.reduce((n,r)=>n+BigInt(r.amountRaw),0n);if(sum>BigInt(supplyRaw))throw Error('INVALID_ALLOCATION_SUM');
 const groups=new Map();for(const r of rows.filter(r=>r.eligible))groups.set(r.wallet,(groups.get(r.wallet)||0n)+BigInt(r.amountRaw));
 return {version:1,mint,supplyRaw,allocations:rows,unresolvedRecords,wallets:[...groups].map(([wallet,n])=>({wallet,amountRaw:n.toString()})),
  unclassifiedSharePct:Number(rows.filter(r=>!r.eligible&&!r.infrastructureVerified&&r.classification!=='burn_account').reduce((n,r)=>n+BigInt(r.amountRaw),0n)*1000000n/BigInt(supplyRaw))/10000,
  restrictedSharePct:Number(rows.filter(r=>r.classification==='restricted_token_account').reduce((n,r)=>n+BigInt(r.amountRaw),0n)*1000000n/BigInt(supplyRaw))/10000,
  verifiedInfrastructureAccounts:rows.filter(r=>r.infrastructureVerified).length,unclassifiedAccounts:rows.filter(r=>!r.eligible&&!r.infrastructureVerified&&r.classification!=='burn_account').length,
  scope:'Observed account roles only. Treasury, exchange custody, vesting and escrow require independently supported control and release evidence. Unknown allocations remain visible; no independence claim.'};
}

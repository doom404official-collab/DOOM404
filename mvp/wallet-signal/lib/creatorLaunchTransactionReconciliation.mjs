import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import bs58 from 'bs58';
import {decodePumpFunCreate,PUMP_PROGRAM_ID} from './pumpFunCreation.mjs';
import {assessCreatorInitialAllocation} from './creatorInitialAllocationEvidence.mjs';
import {classifyVerifiedCreatorAcquisition} from './creatorVerifiedAcquisitionClassifier.mjs';
const TOKEN='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',SYSTEM='11111111111111111111111111111111',ATA='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const key=x=>typeof x==='string'?x:x?.pubkey;
const uint=x=>(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)||Number.isSafeInteger(x)&&x>=0)&&BigInt(x)<=18446744073709551615n;
const fail=reason=>({version:1,status:'UNVERIFIED',reason,event:null,initialAllocationEvidence:null,historyComplete:false,scoreEligible:false});
/** Transaction-local create_v2 + exact-SOL buy proof. This does not certify the
 * historical fee-recipient authorization, program binary, or archival coverage.
 * IDL reference: pump-public-docs e0687ae9b7e064a0f54efc7297c65eecfbba3a8f.
 * Token account owners are proved by initialization and this transaction's balances.
 */
export function reconcileCreatorLaunchTransaction({mint,creator,signature,transaction:tx}={}){
 try{
  new PublicKey(mint);new PublicKey(creator);
  if(!Number.isSafeInteger(tx?.slot)||tx.slot<0||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0||tx.meta?.err!==null||
   !Array.isArray(tx.transaction?.signatures)||tx.transaction.signatures[0]!==signature||!['legacy',0].includes(tx.version))return fail('TRANSACTION_IDENTITY_UNVERIFIED');
  const m=tx.transaction.message,keys=m.accountKeys.map(key),outer=m.instructions,groups=tx.meta.innerInstructions;
  if(!Array.isArray(outer)||!Array.isArray(groups)||new Set(groups.map(g=>g.index)).size!==groups.length||groups.some(g=>!Number.isSafeInteger(g.index)||g.index<0||g.index>=outer.length||!Array.isArray(g.instructions)))return fail('INSTRUCTION_CONTEXT_UNVERIFIED');
  if(!m.accountKeys.some(k=>key(k)===creator&&k.signer===true))return fail('CREATOR_SIGNATURE_MISSING');
  const creations=outer.flatMap((ix,index)=>{const d=decodePumpFunCreate({instruction:ix,transaction:tx,mint,programId:ix.programId});return d&&d.creator===creator&&d.user===creator?[{ix,index,d}]:[];});
  if(creations.length!==1)return fail('CREATION_ROLE_UNVERIFIED');const c=creations[0];
  const [curve]=PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'),new PublicKey(mint).toBuffer()],new PublicKey(PUMP_PROGRAM_ID));
  const ata=owner=>PublicKey.findProgramAddressSync([new PublicKey(owner).toBuffer(),new PublicKey(TOKEN).toBuffer(),new PublicKey(mint).toBuffer()],new PublicKey(ATA))[0].toBase58();
  const pool=ata(curve.toBase58()),buyer=ata(creator),ca=c.ix.accounts.map(key);
  if(!c.d.decoderVersion.startsWith('pump-fun-create_v2-')||ca[2]!==curve.toBase58()||ca[3]!==pool||ca[7]!==TOKEN)return fail('CREATION_ACCOUNT_LAYOUT_UNVERIFIED');
  const flat=outer.flatMap((ix,index)=>[{ix,outer:index,inner:null},...(groups.find(g=>g.index===index)?.instructions??[]).map((ix,inner)=>({ix,outer:index,inner}))]);
  const token=flat.filter(x=>x.ix.programId===TOKEN);
  const allowed=new Set(['initializeMetadataPointer','initializeMint2','getAccountDataSize','initializeImmutableOwner','initializeAccount3','initializeTokenMetadata','updateTokenMetadataAuthority','mintTo','setAuthority','transferChecked']);
  if(token.some(x=>!allowed.has(x.ix.parsed?.type)))return fail('TOKEN_LIFECYCLE_UNSUPPORTED');
  const birth=flat.filter(x=>x.ix.programId===SYSTEM&&x.ix.parsed?.type==='createAccount'&&x.ix.parsed.info?.newAccount===mint);
  if(birth.length!==1||birth[0].outer!==c.index||birth[0].ix.parsed.info.owner!==TOKEN||birth[0].ix.parsed.info.source!==creator)return fail('MINT_BIRTH_UNVERIFIED');
  const init=token.filter(x=>x.ix.parsed.type==='initializeMint2'&&x.ix.parsed.info.mint===mint);
  const issued=token.filter(x=>x.ix.parsed.type==='mintTo');
  const revoke=token.filter(x=>x.ix.parsed.type==='setAuthority');
  if(init.length!==1||init[0].outer!==c.index||init[0].ix.parsed.info.mintAuthority!==ca[1]||init[0].ix.parsed.info.decimals!==6||
   issued.length!==1||issued[0].outer!==c.index||issued[0].ix.parsed.info.mint!==mint||issued[0].ix.parsed.info.account!==pool||issued[0].ix.parsed.info.mintAuthority!==ca[1]||!uint(issued[0].ix.parsed.info.amount)||BigInt(issued[0].ix.parsed.info.amount)<=0n||
   revoke.length!==1||revoke[0].outer!==c.index||revoke[0].inner<=issued[0].inner||revoke[0].ix.parsed.info.mint!==mint||revoke[0].ix.parsed.info.authority!==ca[1]||revoke[0].ix.parsed.info.authorityType!=='mintTokens'||revoke[0].ix.parsed.info.newAuthority!==null)return fail('INITIAL_ISSUANCE_UNVERIFIED');
  const ownership=new Map();for(const x of token.filter(x=>x.ix.parsed.type==='initializeAccount3')){const i=x.ix.parsed.info;if(i.mint!==mint||ownership.has(i.account))return fail('TOKEN_OWNERSHIP_CONFLICT');ownership.set(i.account,{owner:i.owner,outer:x.outer,inner:x.inner});}
  if(ownership.get(pool)?.owner!==curve.toBase58()||ownership.get(buyer)?.owner!==creator||ownership.get(pool).outer!==c.index)return fail('TRANSACTION_LOCAL_OWNERSHIP_UNVERIFIED');
  if((tx.meta.preTokenBalances??[]).some(b=>b.mint===mint))return fail('NEW_MINT_PREBALANCE_CONFLICT');
  const balances=(tx.meta.postTokenBalances??[]).filter(b=>b.mint===mint);
  if(balances.length!==2||balances.some(b=>b.programId!==TOKEN||!uint(b.uiTokenAmount?.amount)||ownership.get(keys[b.accountIndex])?.owner!==b.owner||b.uiTokenAmount.decimals!==6))return fail('POST_TOKEN_BALANCES_UNVERIFIED');
  if(balances.reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n)!==BigInt(issued[0].ix.parsed.info.amount))return fail('ISSUANCE_BALANCE_MISMATCH');
  const buys=outer.flatMap((ix,index)=>{if(ix.programId!==PUMP_PROGRAM_ID||typeof ix.data!=='string')return [];const b=Buffer.from(bs58.decode(ix.data));return b.length>=8&&b.subarray(0,8).equals(createHash('sha256').update('global:buy_exact_sol_in').digest().subarray(0,8))?[{ix,index,b}]:[];});
  if(buys.length!==1)return fail('EXACT_SOL_BUY_UNVERIFIED');const b=buys[0],ba=b.ix.accounts.map(key);
  if(b.index<=c.index||b.b.length!==25||![0,1].includes(b.b[24])||ba.length<16||ba[2]!==mint||ba[3]!==curve.toBase58()||ba[4]!==pool||ba[5]!==buyer||ba[6]!==creator||ba[7]!==SYSTEM||ba[8]!==TOKEN||ba[11]!==PUMP_PROGRAM_ID||ownership.get(buyer).outer>=b.index)return fail('EXACT_SOL_BUY_LAYOUT_UNVERIFIED');
  const transfers=token.filter(x=>x.ix.parsed.type==='transferChecked');
  if(transfers.length!==1||transfers[0].outer!==b.index)return fail('TOKEN_DISTRIBUTION_AMBIGUOUS');const tr=transfers[0],i=tr.ix.parsed.info;
  if(i.source!==pool||i.destination!==buyer||i.mint!==mint||i.authority!==curve.toBase58()||i.tokenAmount?.decimals!==6||!uint(i.tokenAmount?.amount)||BigInt(i.tokenAmount.amount)<=0n||BigInt(i.tokenAmount.amount)<b.b.readBigUInt64LE(16))return fail('TOKEN_RECEIPT_UNVERIFIED');
  const received=balances.find(x=>keys[x.accountIndex]===buyer);if(!received||received.uiTokenAmount.amount!==i.tokenAmount.amount)return fail('CREATOR_RECEIPT_BALANCE_MISMATCH');
  // Reconcile every creator lamport change, including account rent, unrelated
  // launch payments and transaction fee, instead of treating all spending as buy cost.
  let debit=0n,credit=0n;const payments=[];
  for(const x of flat.filter(x=>x.ix.programId===SYSTEM)){
   const p=x.ix.parsed,inf=p?.info;if(!['transfer','createAccount'].includes(p?.type)||!inf||!uint(inf.lamports))return fail('SOL_MOVEMENT_UNSUPPORTED');
   const to=p.type==='transfer'?inf.destination:inf.newAccount;
   if(inf.source===creator)debit+=BigInt(inf.lamports);if(to===creator)credit+=BigInt(inf.lamports);
   if(x.outer===b.index&&p.type==='transfer'&&inf.source===creator&&to===curve.toBase58())payments.push(x);
  }
  const ci=keys.indexOf(creator);if(ci<0||!uint(tx.meta.preBalances?.[ci])||!uint(tx.meta.postBalances?.[ci])||!uint(tx.meta.fee))return fail('SOL_BALANCES_UNVERIFIED');
  const fee=keys[0]===creator?BigInt(tx.meta.fee):0n;
  if(BigInt(tx.meta.preBalances[ci])-BigInt(tx.meta.postBalances[ci])!==debit-credit+fee)return fail('CREATOR_SOL_BALANCE_MISMATCH');
  if(payments.length!==1||BigInt(payments[0].ix.parsed.info.lamports)<=0n||BigInt(payments[0].ix.parsed.info.lamports)>b.b.readBigUInt64LE(8))return fail('CURVE_PAYMENT_UNVERIFIED');
  const proof={signature,instructionIndex:b.index,innerInstructionIndex:tr.inner,mint,creator,type:'PURCHASE',timestamp:tx.blockTime,amountRaw:i.tokenAmount.amount,independentlyVerified:true,instructionVerified:true,settlementVerified:true};
  const promoted=classifyVerifiedCreatorAcquisition({mint,creator,observation:proof,proof});if(promoted.status!=='VERIFIED')return fail('LEDGER_EVENT_REJECTED');
  return {version:1,status:'VERIFIED_TRANSACTION_LOCAL_LAUNCH',signature,slot:tx.slot,creator,mint,creationInstructionIndex:c.index,purchaseInstructionIndex:b.index,event:promoted.event,
   initialAllocationEvidence:{...assessCreatorInitialAllocation({mint,creator,launchTimestamp:tx.blockTime,distributions:[],coverageComplete:true}),scope:'Original create_v2 issuance; launch-transaction purchase accounted separately',signature,slot:tx.slot,creationInstructionIndex:c.index},
   settlement:{poolTokenAccount:pool,creatorTokenAccount:buyer,curvePaymentLamports:String(payments[0].ix.parsed.info.lamports),creatorTotalDebitLamports:debit.toString(),transactionFeeLamports:fee.toString(),mintedRaw:String(issued[0].ix.parsed.info.amount),historicalFeeAuthorizationVerified:false},
   decoderVersion:'pump-create-v2-exact-sol-transaction-local-v1',historyComplete:false,scoreEligible:false};
 }catch{return fail('MALFORMED_LAUNCH_TRANSACTION');}
}

import {PublicKey} from '@solana/web3.js';
import {allocationAccountBytes} from './allocationControlEvidence.mjs';
export const STREAMFLOW_PROGRAM='strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m';
export const STREAMFLOW_STATE_SOURCE=Object.freeze({repository:'streamflow-finance/rust-sdk',commit:'63df7d7b831340daa27f31d007eec2a98380364c',path:'programs/streamflow-sdk/src/state.rs',blob:'9661cdf8a5d639330ef919376cfdfb5b558d00c3'});
const ZERO='11111111111111111111111111111111';
/** Official Borsh Contract v4, without an Anchor account discriminator. Decoding
 * proves the observed contract configuration, never deployed-code equivalence,
 * permanent locking, upgrade safety, or beneficial ownership. Raw amounts remain
 * integer strings. Missing/invalid timestamps cannot establish current vesting. */
export function verifyStreamflowAllocationControls({metadataAddress,metadataAccount,tokenAccountAddress,tokenAccount,mint,observedAt,evidenceSlot,supportingSignature}={}){
 try{
  const b=allocationAccountBytes(metadataAccount);if(!b||b.length!==1104||String(metadataAccount.owner)!==STREAMFLOW_PROGRAM)return null;
  let o=0;const u64=()=>{const n=b.readBigUInt64LE(o);o+=8;return n;},u8=()=>b[o++],pk=()=>{const k=new PublicKey(b.subarray(o,o+32)).toBase58();o+=32;return k;},u32=()=>{const n=b.readUInt32LE(o);o+=4;return n;},f32=()=>{const n=b.readFloatLE(o);o+=4;if(!Number.isFinite(n)||n<0||n>100)throw Error('fee');return n;};
  if(u64()!==4n||u8()!==4)return null;
  const r={schema:'verified-streamflow-allocation-v1',protocol:'streamflow',evidenceSlot:Number.isSafeInteger(evidenceSlot)&&evidenceSlot>0?evidenceSlot:null,supportingSignature:typeof supportingSignature==='string'?supportingSignature:null,metadataAddress,mint,createdAt:u64().toString(),amountWithdrawnRaw:u64().toString(),canceledAt:u64().toString(),endTime:u64().toString(),lastWithdrawnAt:u64().toString()};
  for(const n of ['sender','senderTokens','recipient','recipientTokens','mint','escrowTokens','streamflowTreasury','streamflowTreasuryTokens'])r[n]=pk();
  r.streamflowFeeTotalRaw=u64().toString();r.streamflowFeeWithdrawnRaw=u64().toString();r.streamflowFeePercent=f32();r.partner=pk();r.partnerTokens=pk();r.partnerFeeTotalRaw=u64().toString();r.partnerFeeWithdrawnRaw=u64().toString();r.partnerFeePercent=f32();
  for(const n of ['startTime','scheduledNetRaw','period','amountPerPeriodRaw','cliff','cliffAmountRaw'])r[n]=u64().toString();
  const bool=n=>{const v=u8();if(v>1)throw Error('boolean');r[n]=!!v;};
  for(const n of ['cancelableBySender','cancelableByRecipient','automaticWithdrawal','transferableBySender','transferableByRecipient','canTopup'])bool(n);
  o+=64;r.withdrawFrequency=u64().toString();if(u32()!==0)return null;bool('pausable');bool('canUpdateRate');if(u32()!==0)return null;bool('metadataIsPda');r.metadataNonce=u32();o+=121;bool('closed');
  for(const n of ['currentPauseStart','pauseCumulative','lastRateChangeTime','fundsUnlockedAtLastRateChangeRaw'])r[n]=u64().toString();
  r.creationFeeLamports=u32();bool('creationFeeClaimed');r.autoClaimFeeLamports=u32();bool('autoClaimFeeClaimed');r.oldMetadata=pk();r.payer=pk();r.metadataBump=u8();
  const seedMetadata=r.oldMetadata===ZERO?metadataAddress:r.oldMetadata;
  const escrow=PublicKey.findProgramAddressSync([Buffer.from('strm'),new PublicKey(seedMetadata).toBuffer()],new PublicKey(STREAMFLOW_PROGRAM))[0].toBase58();
  if(r.metadataIsPda){const nonce=Buffer.alloc(4);nonce.writeUInt32BE(r.metadataNonce);const [p,bump]=PublicKey.findProgramAddressSync([Buffer.from('strm-met'),new PublicKey(mint).toBuffer(),new PublicKey(r.payer).toBuffer(),nonce],new PublicKey(STREAMFLOW_PROGRAM));if(p.toBase58()!==metadataAddress||bump!==r.metadataBump)return null;}
  const info=tokenAccount?.data?.parsed?.info;
  if(tokenAccount?.executable!==false||String(tokenAccount.owner)!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'||tokenAccount.data?.parsed?.type!=='account'||info?.mint!==mint||r.mint!==mint||r.escrowTokens!==tokenAccountAddress||escrow!==tokenAccountAddress||info.owner!==escrow||info.state!=='initialized'||info.delegate||info.closeAuthority)return null;
  if(!/^\d+$/.test(info.tokenAmount?.amount??''))return null;
  const gross=BigInt(info.tokenAmount.amount);if(gross>18446744073709551615n)return null;const net=BigInt(r.scheduledNetRaw),withdrawn=BigInt(r.amountWithdrawnRaw);if(withdrawn>net||BigInt(r.cliffAmountRaw)>net||BigInt(r.period)===0n)return null;
  const remaining=net-withdrawn;r.grossRaw=gross.toString();r.scheduledRemainingRaw=remaining.toString();r.unclassifiedSurplusRaw=(gross>remaining?gross-remaining:0n).toString();r.escrowShortfallRaw=(gross<remaining?remaining-gross:0n).toString();
  const milliseconds=typeof observedAt==='string'?Date.parse(observedAt):NaN;const now=Number.isFinite(milliseconds)&&milliseconds>=0?BigInt(Math.floor(milliseconds/1000)):null;
  if(now!==null&&BigInt(r.createdAt)>now)return null;
  r.observedAt=now===null?null:new Date(milliseconds).toISOString();r.currentlyWithdrawableNetRaw=null;r.restrictedNetRaw=null;
  r.scheduleCalculationSupported=BigInt(r.cliffAmountRaw)===net&&r.startTime===r.cliff&&r.endTime===r.cliff&&r.currentPauseStart==='0'&&r.pauseCumulative==='0'&&r.lastRateChangeTime==='0'&&r.fundsUnlockedAtLastRateChangeRaw==='0';
  if(now!==null&&r.scheduleCalculationSupported&&!r.closed&&r.canceledAt==='0'&&gross>=remaining){
   const start=BigInt(r.cliff)>0n?BigInt(r.cliff):BigInt(r.startTime),effective=BigInt(r.lastRateChangeTime)>start?BigInt(r.lastRateChangeTime):start;
   let unlocked=0n;const pauseStart=BigInt(r.currentPauseStart),pause=BigInt(r.pauseCumulative)+(pauseStart>0n&&now>pauseStart?now-pauseStart:0n);
   if(now>=start){if(now>=BigInt(r.endTime)&&pauseStart===0n)unlocked=net;else{const duration=now-effective-pause;const vested=duration>0n?duration/BigInt(r.period)*BigInt(r.amountPerPeriodRaw):0n;const cliff=(now>=BigInt(r.cliff)&&!(pauseStart>0n&&pauseStart<BigInt(r.cliff)))?BigInt(r.cliffAmountRaw):0n;unlocked=vested+BigInt(r.fundsUnlockedAtLastRateChangeRaw)+cliff;if(unlocked>net)unlocked=net;}}
   const available=unlocked>withdrawn?unlocked-withdrawn:0n;r.currentlyWithdrawableNetRaw=available.toString();r.restrictedNetRaw=(remaining-available).toString();
  }
  r.creatorDirectHoldings=false;r.senderIsRecipient=r.sender===r.recipient;r.withdrawalConditionsVerified=true;r.programUpgradeAuthorityVerified=false;r.permanentLockVerified=false;r.economicOwnershipVerified=false;
  r.restrictionMutable=r.cancelableBySender||r.cancelableByRecipient||r.pausable||r.canUpdateRate;r.feeSurplusTreatmentVerified=false;r.classification='vesting_escrow';r.basis='official_v4_metadata_owner_escrow_pda_mint_and_token_authority_binding';r.source=STREAMFLOW_STATE_SOURCE;
  r.limitations=[...(!r.scheduleCalculationSupported?['Current claimability for this release schedule is not verified by the supported single-cliff calculation.']:[]),'Deployed program upgrade authority and administrative override behaviour have not been verified.','Gross escrow balance is not a direct wallet holding; scheduled net and unclassified surplus are separate.','Fee-associated surplus withdrawal treatment is unresolved.'];return r;
 }catch{return null;}
}
export const UPGRADEABLE_LOADER='BPFLoaderUpgradeab1e11111111111111111111111';
export const STREAMFLOW_PROGRAM_DATA=PublicKey.findProgramAddressSync([new PublicKey(STREAMFLOW_PROGRAM).toBuffer()],new PublicKey(UPGRADEABLE_LOADER))[0].toBase58();
/** Standard loader-v3 enum Program=2, ProgramData=3. Primary source:
 * solana-labs/solana sdk/program/src/bpf_loader_upgradeable.rs.
 * Upgrade authority absence does not audit the program's own administrative paths. */
export function verifyStreamflowUpgradeControl({programAccount,programDataAddress,programDataAccount,dataSlice=null}={}){
 try{
  if(programAccount?.executable!==true||programDataAccount?.executable!==false||String(programAccount.owner)!==UPGRADEABLE_LOADER||String(programDataAccount.owner)!==UPGRADEABLE_LOADER||programDataAddress!==STREAMFLOW_PROGRAM_DATA)return null;
  const raw=a=>{if(Buffer.isBuffer(a.data))return a.data;const d=a.data;if(!Array.isArray(d)||d[1]!=='base64'||typeof d[0]!=='string'||d[0].length>14000000)return null;const b=Buffer.from(d[0],'base64');return b.toString('base64')===d[0]?b:null;};
  const p=raw(programAccount),d=raw(programDataAccount);if(!p||p.length!==36||!d||d.length<45||d.length>10485805||p.readUInt32LE(0)!==2||d.readUInt32LE(0)!==3||new PublicKey(p.subarray(4,36)).toBase58()!==programDataAddress||d[12]>1)return null;
  if(dataSlice!==null){
   if(dataSlice.offset!==0||dataSlice.length!==1104||!Number.isSafeInteger(programDataAccount.space)||programDataAccount.space<45||d.length!==Math.min(programDataAccount.space,1104)||!Number.isSafeInteger(programAccount.space)||programAccount.space!==36)return null;
  }else if(Number.isSafeInteger(programDataAccount.space)&&programDataAccount.space!==d.length)return null;
  const authority=d[12]===1?new PublicKey(d.subarray(13,45)).toBase58():null;
  if(authority===ZERO)return null;
  return {schema:'verified-streamflow-upgrade-control-v1',program:STREAMFLOW_PROGRAM,programDataAddress,headerOnly:dataSlice!==null,dataSlice:dataSlice?{offset:0,length:1104}:null,accountSpace:programDataAccount.space??d.length,observedBytes:d.length,deployedCodeAudited:false,lastDeployedSlot:d.readBigUInt64LE(4).toString(),programUpgradeAuthorityVerified:true,upgradeAuthority:authority,programUpgradeable:authority!==null,administrativeOverrideBehaviourVerified:false,permanentLockVerified:false,basis:'loader_v3_program_pointer_canonical_programdata_pda_and_state',source:'https://github.com/solana-labs/solana/blob/master/sdk/program/src/bpf_loader_upgradeable.rs'};
 }catch{return null;}
}

/** Normalize only a complete classic 165-byte SPL token account from a bounded
 * prefix RPC response. Extension-bearing Token-2022 accounts are unsupported. */
export function normalizeStreamflowEscrowAccount(account){
 try{
  const b=allocationAccountBytes(account);if(!b||b.length!==165||String(account.owner)!=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'||(Number.isSafeInteger(account.space)&&account.space!==165))return null;
  const option=offset=>{const n=b.readUInt32LE(offset);if(n>1)throw Error('option');return n;};
  const delegate=option(72),native=option(109),close=option(129);if(![1,2].includes(b[108]))return null;
  const info={mint:new PublicKey(b.subarray(0,32)).toBase58(),owner:new PublicKey(b.subarray(32,64)).toBase58(),state:b[108]===1?'initialized':'frozen',isNative:!!native,tokenAmount:{amount:b.readBigUInt64LE(64).toString()}};
  if(delegate){info.delegate=new PublicKey(b.subarray(76,108)).toBase58();info.delegatedAmount={amount:b.readBigUInt64LE(121).toString()};}
  if(close)info.closeAuthority=new PublicKey(b.subarray(133,165)).toBase58();
  if(native)info.rentExemptReserve={amount:b.readBigUInt64LE(113).toString()};
  return {...account,data:{program:'spl-token',space:165,parsed:{type:'account',info}}};
 }catch{return null;}
}

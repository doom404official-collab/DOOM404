import {PublicKey} from '@solana/web3.js';
import {PUMP_PROGRAM_ID} from './pumpFunCreation.mjs';
const TOKEN=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const COMPUTE='ComputeBudget111111111111111111111111111111';
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<=18446744073709551615n;
function bytes(s){if(typeof s!=='string'||s.length>1600)throw Error();let n=0n;for(const c of s){const i='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.indexOf(c);if(i<0)throw Error();n=n*58n+BigInt(i);}let h=n.toString(16);if(h.length%2)h='0'+h;return Buffer.concat([Buffer.alloc((s.match(/^1*/)||[''])[0].length),n?Buffer.from(h,'hex'):Buffer.alloc(0)]);}
const pda=(seed,program,extra=[])=>PublicKey.findProgramAddressSync([Buffer.from(seed),...extra],new PublicKey(program))[0].toBase58();
/** Pinned Pump public IDL distribute_fee_to_holders. Exact CPI transfers and all
 * recipient deltas must reconcile. Proves a receipt, never a purchase or sale.
 * Account-creation and SOL-quote variants deliberately remain unsupported. */
export function verifyPumpHolderRewardReceipt({mint,creator,signature,transaction:tx}={}){
 try{
  if(tx?.meta?.err!==null||tx.transaction?.signatures?.[0]!==signature||!['legacy',0,1].includes(tx.version)||!Number.isSafeInteger(tx.slot)||!Number.isSafeInteger(tx.blockTime)||tx.blockTime<=0)return null;
  const m=tx.transaction.message,keys=m.accountKeys.map(k=>k.pubkey),outer=m.instructions;
  const operations=outer.map((ix,index)=>({ix,index})).filter(x=>x.ix.programId!==COMPUTE);
  if(operations.length!==1)return null;
  const {ix,index}=operations[0],a=ix.accounts,d=bytes(ix.data);
  if(ix.programId!==PUMP_PROGRAM_ID||!Array.isArray(a)||d.length<12||!d.subarray(0,8).equals(Buffer.from([98,54,145,97,2,70,173,43])))return null;
  const count=d.readUInt32LE(8);if(count<1||count>64||d.length!==12+8*count||a.length!==11+2*count||a[5]!==mint||!TOKEN.has(a[6])||a[7]!=='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'||a[8]!=='11111111111111111111111111111111'||a[10]!==PUMP_PROGRAM_ID)return null;
  if(a[0]!==pda('global',PUMP_PROGRAM_ID)||a[3]!==pda('holder-rewards',PUMP_PROGRAM_ID,[new PublicKey(a[2]).toBuffer()])||a[9]!==pda('__event_authority',PUMP_PROGRAM_ID)||!m.accountKeys.some(k=>k.pubkey===a[1]&&k.signer===true))return null;
  const groups=tx.meta.innerInstructions;if(!Array.isArray(groups)||groups.length!==1||groups[0].index!==index)return null;
  const inner=groups[0].instructions,transfers=inner.filter(x=>TOKEN.has(x.programId)&&x.parsed?.type==='transferChecked');
  if(transfers.length!==count||inner.some(x=>TOKEN.has(x.programId)?!['transferChecked','getAccountDataSize','initializeImmutableOwner','initializeAccount3'].includes(x.parsed?.type):x.programId===a[7]? !['create','createIdempotent'].includes(x.parsed?.type):x.programId===a[8]?x.parsed?.type!=='createAccount':!(x.programId===PUMP_PROGRAM_ID&&x.accounts?.length===1&&x.accounts[0]===a[9]&&bytes(x.data).subarray(0,8).equals(Buffer.from([228,69,165,46,81,203,154,29])))))return null;
  const row=(rows,account,owner)=>{const r=rows.filter(b=>keys[b.accountIndex]===account);if(r.length!==1)throw Error();const v=r[0];if(v.mint!==mint||v.owner!==owner||v.programId!==a[6]||!uint(v.uiTokenAmount?.amount))throw Error();return v;};
  const before=tx.meta.preTokenBalances,after=tx.meta.postTokenBalances,sourceBefore=row(before,a[4],a[3]),sourceAfter=row(after,a[4],a[3]),decimals=sourceBefore.uiTokenAmount.decimals;
  if(!Number.isInteger(decimals)||decimals<0||decimals>255||sourceAfter.uiTokenAmount.decimals!==decimals)return null;
  let total=0n,event=null;const recipients=new Set();
  for(let j=0;j<count;j++){
   const owner=a[11+2*j],destination=a[12+2*j],amount=d.readBigUInt64LE(12+8*j),transfer=transfers[j],i=transfer.parsed?.info;
   if(recipients.has(destination)||destination===a[4]||transfer.stackHeight!==2||transfer.programId!==a[6]||transfer.parsed?.type!=='transferChecked'||i?.source!==a[4]||i.destination!==destination||i.authority!==a[3]||i.mint!==mint||i.tokenAmount?.amount!==amount.toString()||i.tokenAmount.decimals!==decimals)return null;
   recipients.add(destination);total+=amount;
   const post=row(after,destination,owner),prior=before.filter(b=>keys[b.accountIndex]===destination);
   const init=inner.filter(x=>x.programId===a[6]&&x.parsed?.type==='initializeAccount3'&&x.parsed.info?.account===destination&&x.parsed.info.owner===owner&&x.parsed.info.mint===mint);
   if(!prior.length&&init.length!==1)return null;
   const pre=prior.length?row(before,destination,owner):{uiTokenAmount:{amount:'0',decimals}};
   if(pre.uiTokenAmount.decimals!==decimals||post.uiTokenAmount.decimals!==decimals||BigInt(post.uiTokenAmount.amount)-BigInt(pre.uiTokenAmount.amount)!==amount)return null;
   if(owner===creator){if(event||amount===0n)return null;event={signature,instructionIndex:index,innerInstructionIndex:inner.indexOf(transfer),mint,creator,type:'EXTERNAL_RECEIPT',timestamp:tx.blockTime,amountRaw:amount.toString(),independentlyVerified:true,instructionVerified:true,purchaseVerified:false,acquisitionMechanism:'protocol_holder_reward_distribution',decoderVersion:'pump-holder-reward-receipt-v1',sourceTokenAccount:a[4],destinationTokenAccount:destination,openingRaw:pre.uiTokenAmount.amount,closingRaw:post.uiTokenAmount.amount};}
  }
  if(BigInt(sourceBefore.uiTokenAmount.amount)-BigInt(sourceAfter.uiTokenAmount.amount)!==total||!event)return null;
  const own=rows=>rows.filter(b=>b.mint===mint&&b.owner===creator);
  if([...own(before),...own(after)].some(b=>!uint(b.uiTokenAmount?.amount)))return null;
  const sum=rows=>own(rows).reduce((n,b)=>n+BigInt(b.uiTokenAmount.amount),0n);
  return sum(after)-sum(before)===BigInt(event.amountRaw)?event:null;
 }catch{return null;}
}

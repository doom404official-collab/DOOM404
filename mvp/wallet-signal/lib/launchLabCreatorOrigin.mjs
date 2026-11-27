import {PublicKey} from '@solana/web3.js';
import {decodeBase58Bytes} from './pumpFunCreation.mjs';
const PROGRAM='LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const INIT_V2=Buffer.from([67,153,175,39,218,16,38,32]);
const key=x=>typeof x==='string'?x:x?.pubkey;
const pda=(seeds,program=PROGRAM)=>PublicKey.findProgramAddressSync(seeds,new PublicKey(program))[0].toBase58();
/** Pinned @raydium-io/raydium-sdk-v2 0.2.87-alpha initializeV2 contract.
 * Account 1 is the protocol-designated creator, not necessarily the payer.
 * Unknown discriminators/Token-2022 layouts remain unsupported. */
export function verifyLaunchLabCreator(tx,mint){
 try{
  const keys=tx.transaction.message.accountKeys,outer=tx.transaction.message.instructions;
  const candidates=[];
  for(let index=0;index<outer.length;index++){
   const ix=outer[index];if(ix.programId!==PROGRAM||typeof ix.data!=='string'||!Array.isArray(ix.accounts)||ix.accounts.length<18||ix.accounts.length>20)continue;
   const a=ix.accounts.map(key),d=Buffer.from(decodeBase58Bytes(ix.data));if(!d.subarray(0,8).equals(INIT_V2)||a[6]!==mint)continue;
   let offset=9;if(d.length<offset||d[8]>18)continue;
   for(let n=0;n<3;n++){if(offset+4>d.length)throw Error();const size=d.readUInt32LE(offset);offset+=4;if(size>2048||offset+size>d.length)throw Error();offset+=size;}
   const curve=d[offset],curveSize=curve===0?26:[1,2].includes(curve)?18:0;
   if(!curveSize||d.length!==offset+curveSize+25||d[offset+curveSize-1]>1||d[d.length-1]>2)continue;
   if(a[11]!==TOKEN||a[14]!=='11111111111111111111111111111111'||a[15]!=='SysvarRent111111111111111111111111111111111'||a[17]!==PROGRAM||a[13]!=='metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')continue;
   if(!keys.some(k=>key(k)===a[0]&&k.signer===true)||!keys.some(k=>key(k)===mint&&k.signer===true))continue;
   a.forEach(x=>new PublicKey(x));
   if(a[4]!==pda([Buffer.from('vault_auth_seed')])||a[5]!==pda([Buffer.from('pool'),new PublicKey(mint).toBuffer(),new PublicKey(a[7]).toBuffer()])||a[8]!==pda([Buffer.from('pool_vault'),new PublicKey(a[5]).toBuffer(),new PublicKey(mint).toBuffer()])||a[9]!==pda([Buffer.from('pool_vault'),new PublicKey(a[5]).toBuffer(),new PublicKey(a[7]).toBuffer()])||a[16]!==pda([Buffer.from('__event_authority')]))continue;
   const inner=tx.meta.innerInstructions?.find(g=>g.index===index)?.instructions||[];
   const births=inner.filter(i=>i.programId==='11111111111111111111111111111111'&&i.parsed?.type==='createAccount'&&i.parsed.info?.newAccount===mint&&i.parsed.info.owner===TOKEN);
   const init=inner.filter(i=>i.programId===TOKEN&&['initializeMint','initializeMint2'].includes(i.parsed?.type)&&i.parsed.info?.mint===mint&&i.parsed.info.decimals===d[8]);
   if(births.length!==1||init.length!==1)continue;
   candidates.push({version:2,mint,creator:a[1],creationUser:a[0],role:'protocol_assigned_creator',verified:true,verification:'transaction_local_protocol_creator',creationSlot:tx.slot,creationTime:tx.blockTime,creationSignature:tx.transaction.signatures[0],decoderVersion:'raydium-launchlab-initialize-v2-sdk-0.2.87',programId:PROGRAM,independentlyReviewed:false,scope:'LaunchLab designated creator; distinct from payer, mint authority and beneficial ownership.'});
  }
  return candidates.length===1?candidates[0]:null;
 }catch{return null;}
}

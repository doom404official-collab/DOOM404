import {PublicKey} from '@solana/web3.js';
import {decodeInstructionBytes} from './liquidityInstructionBytes.mjs';
/** Official Pump TradeEvent Borsh prefix through buyback_fee. The event must be
 * a direct self-CPI under the verified trade. This does not establish settlement
 * by itself: callers must still reconcile token and lamport boundaries. */
export function readPumpTradeEvent({instructions,program,eventAuthority,depth,mint,user,amountRaw,isSale,timestamp}={}){
 try{
  const matches=[];
  for(const ix of instructions||[]){
   if(ix.programId!==program||ix.stackHeight!==depth+1||ix.accounts?.length!==1||ix.accounts[0]!==eventAuthority)continue;
   const d=decodeInstructionBytes(ix.data);if(!d||d.subarray(0,16).toString('hex')!=='e445a52e51cb9a1dbddb7fd34ee661ee')continue;
   let o=16;const pk=()=>{if(o+32>d.length)throw Error();const p=new PublicKey(d.subarray(o,o+32)).toBase58();o+=32;return p;},u=()=>{const n=d.readBigUInt64LE(o);o+=8;return n;},b=()=>{const n=d[o++];if(n!==0&&n!==1)throw Error();return n;};
   const tokenMint=pk(),solAmount=u(),tokenAmount=u(),isBuy=b(),actor=pk(),time=u();
   for(let n=0;n<4;n++)u();pk();u();const protocolFee=u();pk();u();const creatorFee=u();b();for(let n=0;n<4;n++)u();
   const size=d.readUInt32LE(o);o+=4;if(size>64||o+size>d.length)throw Error();const instructionName=d.subarray(o,o+size).toString('utf8');o+=size;
   b();u();u();u();const buybackFee=u();
   if(tokenMint===mint&&actor===user&&tokenAmount===BigInt(amountRaw)&&isBuy===(isSale?0:1)&&time>0n&&solAmount>0n)matches.push({solAmountRaw:solAmount.toString(),buybackFeeRaw:buybackFee.toString(),instructionName,protocolFeeRaw:protocolFee.toString(),creatorFeeRaw:creatorFee.toString(),chainClockTimestamp:time.toString()});
  }
  return matches.length===1?matches[0]:null;
 }catch{return null;}
}

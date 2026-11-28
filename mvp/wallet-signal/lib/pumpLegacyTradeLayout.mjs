import {PublicKey} from '@solana/web3.js';
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',WSOL='So11111111111111111111111111111111111111112',SYSTEM='11111111111111111111111111111111',ATA=new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const AMM='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',CURVE='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const pda=(seed,key,program)=>PublicKey.findProgramAddressSync([Buffer.from(seed),new PublicKey(key).toBuffer()],new PublicKey(program))[0].toBase58();
const ata=(owner,mint,token)=>PublicKey.findProgramAddressSync([new PublicKey(owner).toBuffer(),new PublicKey(token).toBuffer(),new PublicKey(mint).toBuffer()],ATA)[0].toBase58();
/** Legacy IDL roles plus the documented cashback / v2 / buyback suffix. No
 * arbitrary remaining accounts are accepted. Normalized roles are subsequently
 * checked against actual settlement, owner metadata and PDA constraints. */
export function normalizeLegacyPumpTrade({program,accounts:a,bytes:d}={}){
 try{
  const disc=d.subarray(0,8).toString('hex'),sale=disc==='33e685a4017f83ad',exact=disc==='38fc74089edfcd5f'||disc==='c62e1552b4d9e870';
  if(!sale&&!exact&&disc!=='66063d1201daebea')return null;
  if(d.length<24||d.length>(sale?24:26)||[...d.subarray(24)].some(v=>v>1))return null;
  const name=sale?'sellV1':exact?'buyExactQuoteInV1':'buyV1';
  if(program===AMM){
   const n=sale?21:23;if(a.length<n)return null;const volume=pda('user_volume_accumulator',a[1],AMM),tail=a.slice(n),poolV2=pda('pool-v2',a[3],AMM);
   let offset=0;if(tail[offset]===ata(volume,a[4],a[12])){offset++;if(sale&&tail[offset++]!==volume)return null;}
   if(tail[offset]===poolV2)offset++;
   let buyback=SYSTEM;if(tail.length-offset===2){buyback=tail[offset++];if(tail[offset++]!==ata(buyback,a[4],a[12]))return null;}
   if(offset!==tail.length)return null;
   return {name,program:AMM,accountCount:a.length,legacy:true,volumeAbsent:sale,normalizedAccounts:[a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8],a[11],a[12],a[13],sale?volume:a[20],sale?a[19]:a[21],buyback,a[15],a[16]]};
  }
  if(program===CURVE){
   const n=sale?14:16;if(a.length<n)return null;const volume=pda('user_volume_accumulator',a[6],CURVE),tail=a.slice(n);let offset=0;
   if(sale&&tail[offset]===volume)offset++;
   if(tail[offset]===pda('bonding-curve-v2',a[2],CURVE))offset++;
   let buyback=SYSTEM;if(tail.length-offset===1)buyback=tail[offset++];if(offset!==tail.length)return null;
   return {name,program:CURVE,accountCount:a.length,legacy:true,volumeAbsent:sale,normalizedAccounts:[a[3],a[6],a[0],a[2],WSOL,a[5],a[6],a[4],a[3],sale?a[9]:a[8],TOKEN,a[7],sale?volume:a[13],sale?a[12]:a[14],buyback,a[10],a[11]]};
  }
  return null;
 }catch{return null;}
}

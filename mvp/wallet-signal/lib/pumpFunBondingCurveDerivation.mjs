import {PublicKey} from '@solana/web3.js';
import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
const ATA_PROGRAM=new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const TOKEN_PROGRAM=new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
/** Independently derive legacy Pump.fun bonding curve and associated token account.
 * Does not prove token-account owner without live account data.
 */
export function derivePumpFunBondingCurveAccounts({mint}={}){
 try{
  const mintKey=new PublicKey(mint),program=new PublicKey(PUMP_FUN_PROGRAM_ID);
  const [bondingCurve]=PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'),mintKey.toBuffer()],program);
  const [poolTokenAccount]=PublicKey.findProgramAddressSync([
   bondingCurve.toBuffer(),TOKEN_PROGRAM.toBuffer(),mintKey.toBuffer()],ATA_PROGRAM);
  return {status:'DERIVED',bondingCurve:bondingCurve.toBase58(),
   poolTokenAccount:poolTokenAccount.toBase58(),tokenProgram:TOKEN_PROGRAM.toBase58(),
   ownershipVerified:false};
 }catch{return {status:'INVALID_MINT',ownershipVerified:false};}
}

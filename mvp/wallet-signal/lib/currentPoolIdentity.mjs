import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {PoolInfoLayout,CLMM_PROGRAM_ID} from '@raydium-io/raydium-sdk-v2';
import {RAYDIUM_CPMM_PROGRAM,decodeCpmmPool} from './raydiumCpmmAssessmentV2.mjs';
const ORCA='whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const disc=name=>createHash('sha256').update('account:'+name).digest().subarray(0,8);
/** Ownership alone is a hint. Mint binding additionally requires a known layout.
 * No concentrated-liquidity reserves or withdrawal rights are inferred here. */
export function identifyCurrentPool(account,mint,poolAddress){
 const owner=account?.owner?.toBase58?.()??null;
 const hint=({[RAYDIUM_CPMM_PROGRAM]:'raydium_cpmm',[CLMM_PROGRAM_ID.toBase58()]:'raydium_clmm',[ORCA]:'orca_whirlpool',pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA:'pump_amm'})[owner]??null;
 const out={ownerProgram:owner,protocol:hint,status:hint?'known_program_layout_unverified':'unsupported_protocol',mintBindingVerified:false,reservesVerified:false,withdrawalControlsVerified:false};
 try{
  if(account.executable!==false||!Buffer.isBuffer(account.data))return out;
  if(hint==='raydium_cpmm'){const p=decodeCpmmPool(account);if(p&&[p.mintA.toBase58(),p.mintB.toBase58()].includes(mint))return {...out,status:'pool_identity_verified',mintBindingVerified:true};}
  if(hint==='raydium_clmm'&&account.data.length===PoolInfoLayout.span&&account.data.subarray(0,8).equals(disc('PoolState'))){const p=PoolInfoLayout.decode(account.data);if([p.mintA.toBase58(),p.mintB.toBase58()].includes(mint))return {...out,status:'pool_identity_verified',mintBindingVerified:true};}
  // Official Orca Whirlpool state: programs/whirlpool/src/state/whirlpool.rs.
  // LEN=8+261+384. Token mints at 101 and 181; config at 8; fee-tier seed at 43.
  if(hint==='orca_whirlpool'&&account.data.length===653&&account.data.subarray(0,8).equals(disc('Whirlpool'))){
   const d=account.data,a=new PublicKey(d.subarray(101,133)),b=new PublicKey(d.subarray(181,213));
   const derived=PublicKey.findProgramAddressSync([Buffer.from('whirlpool'),d.subarray(8,40),a.toBuffer(),b.toBuffer(),d.subarray(43,45)],new PublicKey(ORCA))[0].toBase58();
   if(derived===poolAddress&&[a.toBase58(),b.toBase58()].includes(mint))return {...out,status:'pool_identity_verified',mintBindingVerified:true};
  }
 }catch{}
 return out;
}

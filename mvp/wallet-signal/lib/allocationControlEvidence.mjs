import {createHash} from 'node:crypto';
import {PublicKey} from '@solana/web3.js';
import {decodePumpAmmPoolState} from './pumpAmmPoolState.mjs';
const PUMP_AMM='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const CLMM='CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
const CPMM='CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
const CPMM_AUTHORITY=PublicKey.findProgramAddressSync([Buffer.from('vault_and_lp_mint_auth_seed')],new PublicKey(CPMM))[0].toBase58();
const ORCA='whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const key=x=>typeof x==='string'?x:x?.toBase58?.();
export function allocationAccountBytes(account){
 if(account?.executable!==false)return null;
 if(Buffer.isBuffer(account.data))return account.data.length<=16384?account.data:null;
 const data=account.data;if(!Array.isArray(data)||data[1]!=='base64'||typeof data[0]!=='string'||data[0].length>22000)return null;
 const b=Buffer.from(data[0],'base64');return b.toString('base64')===data[0]&&b.length<=16384&&(!Number.isSafeInteger(account.space)||account.space===b.length)?b:null;
}
/** A vault role is established only by the actual sampled token account plus a
 * mint-bound protocol pool state and matching authority PDA. It does not establish
 * LP custody, permanent locks, redemption restrictions or harmlessness. */
export function verifyAllocationPoolRole({mint,tokenAccount,authority,authorityAccount}={}){
 try{
  const owner=key(authorityAccount?.owner),data=allocationAccountBytes(authorityAccount);if(!data)return null;
  const pub=x=>new PublicKey(x),derive=(seeds,program)=>PublicKey.findProgramAddressSync(seeds,pub(program))[0].toBase58();
  let protocol=null,basis=null;
  if(owner===PUMP_AMM){
   const p=decodePumpAmmPoolState(data,owner);if(!p)return null;
   const n=Buffer.alloc(2);n.writeUInt16LE(p.index);
   const derived=derive([Buffer.from('pool'),n,pub(p.creator).toBuffer(),pub(p.baseMint).toBuffer(),pub(p.quoteMint).toBuffer()],PUMP_AMM);
   if(derived!==authority||!(p.baseMint===mint&&p.poolBaseTokenAccount===tokenAccount||p.quoteMint===mint&&p.poolQuoteTokenAccount===tokenAccount))return null;
   protocol='pump_amm';basis='pinned_pump_pool_pda_mint_and_vault_binding';
  }else if(owner===CLMM){
   // @raydium-io/raydium-sdk-v2@0.2.87-alpha PoolInfoLayout (1544 bytes)
   // and libraries/pda.ts canonical pool/vault seeds. Customizable V2 pool
   // variants are not inferred from this standard-pool decoder.
   if(data.length!==1544||!data.subarray(0,8).equals(createHash('sha256').update('account:PoolState').digest().subarray(0,8)))return null;
   const config=data.subarray(9,41),a=pub(data.subarray(73,105)).toBase58(),b=pub(data.subarray(105,137)).toBase58(),va=pub(data.subarray(137,169)).toBase58(),vb=pub(data.subarray(169,201)).toBase58();
   if(derive([Buffer.from('pool'),config,pub(a).toBuffer(),pub(b).toBuffer()],CLMM)!==authority||!(a===mint&&va===tokenAccount||b===mint&&vb===tokenAccount)||derive([Buffer.from('pool_vault'),pub(authority).toBuffer(),pub(mint).toBuffer()],CLMM)!==tokenAccount)return null;
   protocol='raydium_clmm';basis='pinned_clmm_standard_pool_pda_mint_and_vault_binding';
  }else if(owner===ORCA){
   // Pinned Whirlpool LEN and field layout already used by currentPoolIdentity.
   // Config at 8, fee-tier seed at 43, mint/vault A at 101/133, B at181/213.
   if(data.length!==653||!data.subarray(0,8).equals(createHash('sha256').update('account:Whirlpool').digest().subarray(0,8)))return null;
   const a=pub(data.subarray(101,133)).toBase58(),b=pub(data.subarray(181,213)).toBase58(),va=pub(data.subarray(133,165)).toBase58(),vb=pub(data.subarray(213,245)).toBase58();
   if(derive([Buffer.from('whirlpool'),data.subarray(8,40),pub(a).toBuffer(),pub(b).toBuffer(),data.subarray(43,45)],ORCA)!==authority||!(a===mint&&va===tokenAccount||b===mint&&vb===tokenAccount))return null;
   protocol='orca_whirlpool';basis='pinned_whirlpool_pda_mint_and_vault_binding';
  }
  return protocol?{version:1,classification:'liquidity_pool_vault',protocol,authority,tokenAccount,mint,classificationBasis:basis,infrastructureVerified:true,ownerControl:'protocol_pool_pda',withdrawalConditionsVerified:false,releaseConditionsVerified:false,scope:'Verified pool reserve-account role only. Liquidity positions/LP holders, redemption rights, administrator and program upgrades remain separate evidence.'}:null;
 }catch{return null;}
}
/** Economic vesting/escrow names are never inferred from a program ID. Token
 * multisig state can establish signer threshold only, not beneficial ownership. */
export function verifyTokenMultisigControl(account){
 try{
  const owner=key(account?.owner);if(!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(owner))return null;
  const b=allocationAccountBytes(account);if(!b||b.length!==355||b[2]!==1||b[0]<1||b[0]>b[1]||b[1]>11)return null;
  const signers=Array.from({length:b[1]},(_,i)=>new PublicKey(b.subarray(3+i*32,35+i*32)).toBase58());
  if(new Set(signers).size!==signers.length||signers.includes('11111111111111111111111111111111'))return null;
  return {kind:'spl_multisig',threshold:b[0],signerCount:b[1],signers,controlVerified:true,beneficialOwnershipVerified:false,releaseConditionsVerified:false};
 }catch{return null;}
}

export function verifyProtocolSigningAuthority(authority){
 try{
  return authority===CPMM_AUTHORITY?{kind:'protocol_signing_authority',protocol:'raydium_cpmm',programId:CPMM,authority,controlVerified:true,poolBindingVerified:false,classificationBasis:'pinned_cpmm_global_vault_authority_pda',releaseConditionsVerified:false,scope:'Program-derived signing authority only. A mint-bound pool/vault association and LP redemption controls remain unverified.'}:null;
 }catch{return null;}
}

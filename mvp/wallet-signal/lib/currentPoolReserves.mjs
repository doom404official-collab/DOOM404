import {PublicKey} from '@solana/web3.js';
import {createHash} from 'node:crypto';
import {decodePumpAmmPoolState} from './pumpAmmPoolState.mjs';
import {inspectTokenVault} from './liquidityVaultEvidence.mjs';
import {decodeToken2022BinaryMint} from './token2022BinaryMint.mjs';
const TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN22='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const WSOL='So11111111111111111111111111111111111111112';
/** Re-derive reserves from retained same-context account bytes. No USD oracle,
 * execution proof, LP custody certification or historical-state claims. */
export function projectCurrentPoolReserves(raw,mint){
 try{
  if(raw?.schemaVersion!==1||!['alchemy','helius','configured_rpc'].includes(raw.provider)||raw.network!=='solana-mainnet'||raw.commitment!=='finalized'||!Number.isFinite(Date.parse(raw.observedAt))||!Array.isArray(raw.addresses)||raw.addresses.length!==6||new Set(raw.addresses).size!==6||!Number.isSafeInteger(raw.response?.context?.slot)||raw.response.context.slot<0||raw.response.value?.length!==6)return null;
  const accounts=raw.response.value.map(a=>{
   if(!a||a.executable!==false||!Array.isArray(a.data)||a.data[1]!=='base64'||typeof a.data[0]!=='string'||a.data[0].length>16384)throw Error();
   const data=Buffer.from(a.data[0],'base64');if(data.length!==a.space||data.toString('base64')!==a.data[0])throw Error();
   return {...a,data,owner:new PublicKey(a.owner)};
  });
  const pool=decodePumpAmmPoolState(accounts[0].data,accounts[0].owner.toBase58());
  if(!pool||pool.baseMint!==mint||pool.quoteMint!==WSOL||pool.poolBaseTokenAccount!==raw.addresses[1]||pool.poolQuoteTokenAccount!==raw.addresses[2]||mint!==raw.addresses[3]||pool.lpMint!==raw.addresses[4]||WSOL!==raw.addresses[5])return null;
  const base=inspectTokenVault(accounts[1],mint),quote=inspectTokenVault(accounts[2],WSOL);
  if(!base.verified||!quote.verified||base.authority!==raw.addresses[0]||quote.authority!==raw.addresses[0]||base.tokenProgram!==accounts[3].owner.toBase58()||quote.tokenProgram!==TOKEN)return null;
  const mintInfo=(a,address)=>{
   if(a.owner.toBase58()===TOKEN22)return decodeToken2022BinaryMint(a,address)?.data.parsed.info;
   if(a.owner.toBase58()!==TOKEN||a.data.length!==82||a.data[45]!==1)return null;
   const optional=o=>{const n=a.data.readUInt32LE(o);if(n>1)throw Error();return n?new PublicKey(a.data.subarray(o+4,o+36)).toBase58():null;};
   return {supply:a.data.readBigUInt64LE(36).toString(),decimals:a.data[44],mintAuthority:optional(0),freezeAuthority:optional(46)};
  };
  const token=mintInfo(accounts[3],mint),lp=mintInfo(accounts[4],pool.lpMint),sol=mintInfo(accounts[5],WSOL);
  if(!token||!lp||!sol||sol.decimals!==9||lp.mintAuthority!==raw.addresses[0]||lp.freezeAuthority!==null||BigInt(base.rawAmount)<=0n||BigInt(quote.rawAmount)<=0n||BigInt(base.rawAmount)>BigInt(token.supply))return null;
  const flags=[];
  for(const [i,label] of [[1,'base'],[2,'quote']])if(accounts[i].data.readUInt32LE(72)!==0||accounts[i].data.readUInt32LE(129)!==0)flags.push(label+'_vault_delegate_or_close_authority_present');
  if(lp.supply!==pool.lpSupply)flags.push('pool_issued_lp_counter_differs_from_current_mint_supply');
  return {schemaVersion:1,mint,pool:raw.addresses[0],observedAt:raw.observedAt,slot:raw.response.context.slot,commitment:'finalized',provider:raw.provider,atomic:true,
   evidenceId:createHash('sha256').update(JSON.stringify({slot:raw.response.context.slot,addresses:raw.addresses,data:raw.response.value.map(a=>a.data[0])})).digest('hex'),
   baseReserveRaw:base.rawAmount,quoteReserveRaw:quote.rawAmount,baseDecimals:token.decimals,quoteDecimals:9,mintSupplyRaw:token.supply,
   lpMint:pool.lpMint,lpSupplyRaw:lp.supply,poolIssuedLpCounterRaw:pool.lpSupply,flags,
   reservesVerified:true,executableDepthVerified:false,lpSecurityVerified:false,
   limitations:['Raw vault balances are not executable depth. Fees, trade execution and USD value are unverified.','LP mint supply does not establish LP ownership, locking or withdrawal control.','Only this pool is covered; independent pool concentration is unverified.']};
 }catch{return null;}
}

import {PublicKey} from '@solana/web3.js';
// Direct creator wallet only. This never establishes linked-wallet holdings,
// historical acquisitions, a selling denominator or score eligibility.
export function projectCreatorWalletObservation(e,mint,creator){
 try{
  if(!e||e.schemaVersion!==1||e.provider!=='alchemy'||e.network!=='solana-mainnet'||e.method!=='getTokenAccountsByOwner'||e.commitment!=='finalized'||e.mint!==mint||e.creator!==creator||!Number.isFinite(Date.parse(e.observedAt))||!Number.isSafeInteger(e.response?.context?.slot)||e.response.context.slot<0||!Array.isArray(e.response.value)||e.response.value.length>1000)return null;
  let total=0n;const seen=new Set();
  for(const row of e.response.value){
   const a=row?.account;new PublicKey(row.pubkey);
   if(seen.has(row.pubkey)||!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(a?.owner)||a.executable!==false||!Array.isArray(a.data)||a.data[1]!=='base64'||typeof a.data[0]!=='string'||a.data[0].length>16384)return null;
   seen.add(row.pubkey);const b=Buffer.from(a.data[0],'base64');
   if(b.length<165||b.length!==a.space||b.toString('base64')!==a.data[0]||![1,2].includes(b[108])||new PublicKey(b.subarray(0,32)).toBase58()!==mint||new PublicKey(b.subarray(32,64)).toBase58()!==creator)return null;
   total+=b.readBigUInt64LE(64);
  }
  if(total>18446744073709551615n)return null;
  return {schemaVersion:1,mint,creator,rawBalance:total.toString(),accountCount:seen.size,slot:e.response.context.slot,observedAt:e.observedAt,commitment:'finalized',source:'alchemy',scope:'verified_creator_wallet_only',scoreEligible:false,linkedWalletsAssessed:false};
 }catch{return null;}
}

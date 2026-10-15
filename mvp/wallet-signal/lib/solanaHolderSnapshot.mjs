// Solana RPC token-account snapshot collector.
// Collects all token accounts for SPL Token and Token-2022, groups by owner,
// and refuses to claim a complete snapshot if RPC slots disagree.
// Provider/RPC must explicitly support untruncated getProgramAccounts responses.
import {Connection,PublicKey} from '@solana/web3.js';
const PROGRAMS=['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFh6z1rP7mGXuUnxS'];
export async function fetchMintHolderSnapshot({rpcUrl,mint,timeoutMs=30000}) {
 if(!rpcUrl || !mint) throw new TypeError('RPC URL and mint required');
 const conn=new Connection(rpcUrl,{commitment:'finalized',confirmTransactionInitialTimeout:timeoutMs});
 const mintKey=new PublicKey(mint);
 const supply=await conn.getTokenSupply(mintKey,'finalized');
 const decimals=supply.value.decimals;
 const programInfo=await conn.getAccountInfo(mintKey,'finalized');
 if(!programInfo) throw new Error('Mint account not found');
 const owner=programInfo.owner.toBase58();
 if(!PROGRAMS.includes(owner)) throw new Error('Unsupported mint program; actual owner: '+owner);
 const response=await conn.getProgramAccounts(new PublicKey(owner),{
   commitment:'finalized',withContext:true,
   filters:[{memcmp:{offset:0,bytes:mint}},...(owner===PROGRAMS[0]?[{dataSize:165}]:[])],
 });
 if(!response || !Array.isArray(response.value)) throw new Error('Unusable RPC holder response');
 if(response.context.slot!==supply.context.slot) throw new Error('Supply and holder snapshots have different slots; retry for consistent data');
 // Token-2022 may have account extensions; first 72 bytes retain base account layout.
 const amounts=new Map();
 let total=0n;
 for(const item of response.value){
   const data=item.account.data;
   if(!Buffer.isBuffer(data) || data.length<72) throw new Error('Malformed token account');
   const accountMint=new PublicKey(data.subarray(0,32)).toBase58();
   if(accountMint!==mint) throw new Error('RPC returned unrelated token account');
   const holder=new PublicKey(data.subarray(32,64)).toBase58();
   const amount=data.readBigUInt64LE(64);
   total+=amount;
   amounts.set(holder,(amounts.get(holder)??0n)+amount);
 }
 const rawSupply=BigInt(supply.value.amount);
 if(total!==rawSupply) throw new Error('Token account totals do not match mint supply; snapshot may be incomplete or inconsistent');
 // Preserve precision: only convert when all values fit JS safe integers.
 if(rawSupply>BigInt(Number.MAX_SAFE_INTEGER) || [...amounts.values()].some(x=>x>BigInt(Number.MAX_SAFE_INTEGER)))
   throw new Error('Large integer token amounts require precision-safe scoring adapter');
 const holders=[...amounts].filter(([,v])=>v>0n).map(([wallet,balance])=>({wallet,balance:Number(balance)}));
 return {slot:response.context.slot,complete:true,holders,circulatingSupply:Number(rawSupply),
   rawMintSupply:Number(rawSupply),decimals,source:'solana-rpc-getProgramAccounts',
   supplyDefinition:'mint-total-supply-not-circulating',
   warning:'Mint total supply is not circulating supply. Exclusions and supply adjustments require verified provenance.'};
}

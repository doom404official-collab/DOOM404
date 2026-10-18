import { PublicKey } from "@solana/web3.js";
const TOKEN_PROGRAMS = new Set([
 "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
 "TokenzQdBNbLqP5VEhdkAS6EPF3zBNqR2f2f7B6VQ5"
]);
export function inspectTokenVault(account, expectedMint) {
 if(!account || !TOKEN_PROGRAMS.has(account.owner?.toBase58?.())) return {verified:false,reason:"unsupported_token_account_program"};
 const data=account.data;
 if(!Buffer.isBuffer(data)||data.length<165)return {verified:false,reason:"invalid_token_account_data"};
 const mint=new PublicKey(data.subarray(0,32)).toBase58();
 if(mint!==expectedMint)return {verified:false,reason:"mint_mismatch",observedMint:mint};
 const authority=new PublicKey(data.subarray(32,64)).toBase58();
 const amount=data.readBigUInt64LE(64).toString();
 const state=data.readUInt8(108);
 if(state!==1)return {verified:false,reason:"token_account_not_initialized",mint,authority};
 return {verified:true,mint,authority,rawAmount:amount,tokenProgram:account.owner.toBase58(),scope:"vault_token_account_only"};
}

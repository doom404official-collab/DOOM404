"use strict";
const PUMP="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const SYSTEM="11111111111111111111111111111111";
const TOKEN=new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
const crypto=require("node:crypto");
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decode(s){if(typeof s!=="string"||!s.length)throw Error("INVALID_ADDRESS");let n=0n;for(const c of s){const i=alphabet.indexOf(c);if(i<0)throw Error("INVALID_ADDRESS");n=n*58n+BigInt(i)}let hex=n.toString(16);if(hex.length%2)hex="0"+hex;const b=Buffer.concat([Buffer.alloc(s.match(/^1*/)[0].length),n?Buffer.from(hex,"hex"):Buffer.alloc(0)]);if(b.length!==32)throw Error("INVALID_ADDRESS");return b}
const p=(1n<<255n)-19n;
const mod=x=>((x%p)+p)%p;
function pow(a,n){let r=1n;for(a=mod(a);n;n>>=1n,a=mod(a*a))if(n&1n)r=mod(r*a);return r}
const d=mod(-121665n*pow(121666n,p-2n));
function onCurve(b){const bytes=Buffer.from(b),sign=bytes[31]>>7;bytes[31]&=127;const y=BigInt("0x"+Buffer.from(bytes).reverse().toString("hex"));if(y>=p)return false;const y2=mod(y*y),den=mod(d*y2+1n);if(!den)return false;const x2=mod((y2-1n)*pow(den,p-2n));return x2===0n?sign===0:pow(x2,(p-1n)/2n)===1n}
function encode(b){let n=BigInt("0x"+b.toString("hex")),s="";while(n){s=alphabet[Number(n%58n)]+s;n/=58n}for(const v of b){if(v)break;s="1"+s}return s}
function pda(seeds,program,bump){for(let b=bump??255;b>=0;b--){const hash=crypto.createHash("sha256").update(Buffer.concat([...seeds,Buffer.from([b]),decode(program),Buffer.from("ProgramDerivedAddress")])).digest();if(!onCurve(hash))return hash;if(bump!==undefined)break}throw Error("PDA_NOT_FOUND")}
function curveAddress(mint){return pda([Buffer.from("bonding-curve"),decode(mint)],PUMP)}
const POOLS=[
 {protocol:"PumpSwap",program:"pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",discriminator:"Pool",minimum:243,mints:[43,75],vaults:[139,171],kind:"VERIFIED_PUMPSWAP_POOL_VAULT",authority:"pool",seeds:r=>[Buffer.from("pool"),r.subarray(9,11),r.subarray(11,43),r.subarray(43,75),r.subarray(75,107)],bump:8},
 {protocol:"Raydium AMM V4",program:"675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",minimum:752,exact:752,mints:[400,432],vaults:[336,368],kind:"VERIFIED_RAYDIUM_POOL_VAULT",authority:"amm"},
 {protocol:"Raydium CPMM",program:"CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",discriminator:"PoolState",minimum:637,mints:[168,200],vaults:[72,104],kind:"VERIFIED_RAYDIUM_POOL_VAULT",authority:"cpmm"},
 {protocol:"Raydium CLMM",program:"CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",discriminator:"PoolState",minimum:1544,mints:[73,105],vaults:[137,169],kind:"VERIFIED_RAYDIUM_POOL_VAULT",authority:"pool",seeds:r=>[Buffer.from("pool"),r.subarray(9,41),r.subarray(73,105),r.subarray(105,137)],bump:8},
 {protocol:"Orca Whirlpool",program:"whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",discriminator:"Whirlpool",minimum:653,mints:[101,181],vaults:[133,213],kind:"VERIFIED_ORCA_POOL_VAULT",authority:"pool",seeds:r=>[Buffer.from("whirlpool"),r.subarray(8,40),r.subarray(101,133),r.subarray(181,213),r.subarray(43,45)],bump:40}
];
const SOURCES={
 "PumpSwap":"https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump_amm.json",
 "Raydium AMM V4":"https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/raydium/liquidity/layout.ts",
 "Raydium CPMM":"https://github.com/raydium-io/raydium-cp-swap/blob/master/programs/cp-swap/src/states/pool.rs",
 "Raydium CLMM":"https://github.com/raydium-io/raydium-clmm/blob/master/programs/amm/src/states/pool.rs",
 "Orca Whirlpool":"https://github.com/orca-so/whirlpools/blob/main/programs/whirlpool/src/state/whirlpool.rs"
};
const isInfrastructure=a=>a?.classification==="PUMP_FUN_BONDING_CURVE_INFRASTRUCTURE"||POOLS.some(p=>p.kind===a?.classification);
function classifyPool({mint,tokenAccount,parsed,pool,slot}){
 const info=parsed?.data?.parsed?.info;
 if(!TOKEN.has(parsed?.owner)||parsed?.data?.parsed?.type!=="account"||info?.mint!==mint||!info.owner||!Number.isSafeInteger(slot)||slot<0)return null;
 const layout=POOLS.find(p=>p.program===pool?.account?.owner);
 if(!layout||pool.account.executable!==false)return null;
 try{
 const r=Buffer.from(pool.account.data?.[0]||"","base64");
 if(pool.account.data?.[1]!=="base64"||r.length<layout.minimum||(layout.exact&&r.length!==layout.exact))return null;
 if(layout.discriminator&&!r.subarray(0,8).equals(crypto.createHash("sha256").update("account:"+layout.discriminator).digest().subarray(0,8)))return null;
 const poolKey=decode(pool.address);
 if(layout.seeds&&!pda(layout.seeds(r),layout.program,r[layout.bump]).equals(poolKey))return null;
 let authority=poolKey;
 if(layout.authority==="cpmm")authority=pda([Buffer.from("vault_and_lp_mint_auth_seed")],layout.program,r[328]);
 if(layout.authority==="amm"){
 const nonce=Number(r.readBigUInt64LE(8));if(nonce>255||r.readBigUInt64LE(0)===0n||r.readBigUInt64LE(0)>7n)return null;
 authority=pda([Buffer.from("amm authority")],layout.program,nonce);
 if(!pda([decode(layout.program),r.subarray(528,560),Buffer.from("amm_associated_seed")],layout.program).equals(poolKey))return null;
 }
 if(!decode(info.owner).equals(authority))return null;
 const m=decode(mint),v=decode(tokenAccount);
 if(!layout.mints.some((off,i)=>r.subarray(off,off+32).equals(m)&&r.subarray(layout.vaults[i],layout.vaults[i]+32).equals(v)))return null;
 if(layout.authority==="cpmm"&&!pda([Buffer.from("pool_vault"),poolKey,m],layout.program).equals(v))return null;
 return {classification:layout.kind,role:"VERIFIED_POOL_VAULT",ownerVerified:true,classificationEvidence:{protocol:layout.protocol,layoutSource:SOURCES[layout.protocol],mint,tokenAccount,pool:pool.address,owner:info.owner,program:layout.program,verifiedSlot:slot,method:"EXACT_POOL_MINT_VAULT_AUTHORITY",discriminator:layout.discriminator||"NOT_APPLICABLE_LEGACY_V4",explorer:"https://solscan.io/account/"+pool.address}};
 }catch{return null}
}
function classify({mint,tokenAccount,parsed,control,slot,pools=[]}){
 const info=parsed?.data?.parsed?.info;
 if(!TOKEN.has(parsed?.owner)||parsed?.data?.parsed?.type!=="account"||info?.mint!==mint||!info.owner)return {classification:"UNCLASSIFIED",role:"TOKEN_ACCOUNT_IDENTITY_UNRESOLVED",ownerVerified:false};
 const base={classification:"UNCLASSIFIED",ownerVerified:true,role:"OWNER_PURPOSE_UNRESOLVED"};
 for(const pool of pools){const result=classifyPool({mint,tokenAccount,parsed,pool,slot});if(result)return result;}
 if(!control)return base;
 if(control.owner===SYSTEM&&control.executable===false)return {...base,role:"SYSTEM_ADDRESS_PURPOSE_UNRESOLVED"};
 if(control.owner===PUMP&&control.executable===false&&Number.isSafeInteger(slot)){
 try{const raw=Buffer.from(control.data?.[0]||"","base64");const disc=crypto.createHash("sha256").update("account:BondingCurve").digest().subarray(0,8);
 if(raw.length>=49&&raw.subarray(0,8).equals(disc)&&decode(info.owner).equals(curveAddress(mint))&&decode(tokenAccount).equals(pda([decode(info.owner),decode(parsed.owner),decode(mint)],"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")))return {...base,classification:"PUMP_FUN_BONDING_CURVE_INFRASTRUCTURE",role:"VERIFIED_BONDING_CURVE",classificationEvidence:{mint,tokenAccount,owner:info.owner,program:PUMP,verifiedSlot:slot,method:"MINT_PDA_ATA_AND_ACCOUNT_DISCRIMINATOR"}};
 }catch{}
 }
 return {...base,role:"PROGRAM_ADDRESS_PURPOSE_UNRESOLVED"};
}
module.exports={classify,classifyPool,curveAddress,pda,decode,encode,POOLS,isInfrastructure};

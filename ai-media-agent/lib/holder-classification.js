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
function curveAddress(mint){const m=decode(mint),program=decode(PUMP);for(let bump=255;bump>=0;bump--){const hash=crypto.createHash("sha256").update(Buffer.concat([Buffer.from("bonding-curve"),m,Buffer.from([bump]),program,Buffer.from("ProgramDerivedAddress")])).digest();if(!onCurve(hash))return hash}throw Error("PDA_NOT_FOUND")}
function classify({mint,tokenAccount,parsed,control,slot}){
 const info=parsed?.data?.parsed?.info;
 if(!TOKEN.has(parsed?.owner)||parsed?.data?.parsed?.type!=="account"||info?.mint!==mint||!info.owner)return {classification:"UNCLASSIFIED",role:"TOKEN_ACCOUNT_IDENTITY_UNRESOLVED",ownerVerified:false};
 const base={classification:"UNCLASSIFIED",ownerVerified:true,role:"OWNER_PURPOSE_UNRESOLVED"};
 if(!control)return base;
 if(control.owner===SYSTEM&&control.executable===false)return {...base,role:"SYSTEM_ADDRESS_PURPOSE_UNRESOLVED"};
 if(control.owner===PUMP&&control.executable===false&&Number.isSafeInteger(slot)){
 try{const raw=Buffer.from(control.data?.[0]||"","base64");const disc=crypto.createHash("sha256").update("account:BondingCurve").digest().subarray(0,8);
 if(raw.length>=49&&raw.subarray(0,8).equals(disc)&&decode(info.owner).equals(curveAddress(mint)))return {...base,classification:"PUMP_FUN_BONDING_CURVE_INFRASTRUCTURE",role:"VERIFIED_BONDING_CURVE",classificationEvidence:{mint,tokenAccount,owner:info.owner,program:PUMP,verifiedSlot:slot,method:"MINT_PDA_AND_ACCOUNT_DISCRIMINATOR"}};
 }catch{}
 }
 if(control.owner==="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"&&control.executable===false&&Number.isSafeInteger(slot)){
 try{const raw=Buffer.from(control.data?.[0]||"","base64"),disc=crypto.createHash("sha256").update("account:Pool").digest().subarray(0,8);
 const m=decode(mint),v=decode(tokenAccount);
 if(raw.length>=211&&raw.subarray(0,8).equals(disc)&&((raw.subarray(43,75).equals(m)&&raw.subarray(139,171).equals(v))||(raw.subarray(75,107).equals(m)&&raw.subarray(171,203).equals(v))))return {...base,classification:"VERIFIED_PUMPSWAP_POOL_VAULT",role:"VERIFIED_POOL_VAULT",classificationEvidence:{mint,tokenAccount,owner:info.owner,program:control.owner,verifiedSlot:slot,method:"POOL_STATE_EXACT_MINT_VAULT_MATCH"}};
 }catch{}
 }
 return {...base,role:"PROGRAM_ADDRESS_PURPOSE_UNRESOLVED"};
}
module.exports={classify,curveAddress};

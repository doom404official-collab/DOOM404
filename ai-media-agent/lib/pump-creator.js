"use strict";
const {bytes58}=require("./protocol-evidence");
const PROGRAM="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const A="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encode(b){let n=0n;for(const x of b)n=(n<<8n)+BigInt(x);let s="";while(n){s=A[Number(n%58n)]+s;n/=58n}for(const x of b){if(x!==0)break;s="1"+s}return s}
function creations(t,signature){
 if(t?.meta?.err!==null)return [];
 const msg=t.transaction?.message||{},out=[];
 for(const ix of [...(msg.instructions||[]),...(t.meta.innerInstructions||[]).flatMap(g=>g.instructions||[])]){
 if(ix.programId!==PROGRAM)continue;
 const b=bytes58(ix.data);if(!b||b.length<52)continue;
 const disc=b.subarray(0,8).toString("hex"),v=disc==="181ec828051c0777"?1:disc==="d6904cec5f8b31b4"?2:0;
 if(!v||ix.accounts?.length<(v===1?14:16))continue;
 const mint=ix.accounts[0],initiator=ix.accounts[v===1?7:5];
 if(!mint||!initiator||ix.accounts[v===1?8:6]!=="11111111111111111111111111111111"||ix.accounts[v===1?9:7]!==(v===1?"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"))continue;
 let p=8,valid=true;for(let i=0;i<3;i++){if(p+4>b.length){valid=false;break}const len=b.readUInt32LE(p);p+=4+len;if(p>b.length){valid=false;break}}
 if(!valid||p+32>b.length||b.subarray(p,p+32).every(x=>x===0))continue;
 const creator=encode(b.subarray(p,p+32));
 out.push({mint,creator,initiator,signature,slot:t.slot,program:PROGRAM,instruction:v===1?"create":"create_v2",source:"https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json",url:"https://solscan.io/tx/"+signature});
 }
 return out;
}
module.exports={creations};

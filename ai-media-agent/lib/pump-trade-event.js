'use strict';
const {bytes58}=require('./protocol-evidence'),schema=require('./pump-event-schema.json');
function encode(b){let n=0n;for(const x of b)n=(n<<8n)+BigInt(x);let s='';const a='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';while(n){s=a[Number(n%58n)]+s;n/=58n}for(const x of b){if(x!==0)break;s='1'+s}return s}
function tradeEvent(ix){try{
 const b=bytes58(ix.data);if(!b||!b.subarray(0,8).equals(Buffer.from([228,69,165,46,81,203,154,29]))||!b.subarray(8,16).equals(Buffer.from([189,219,127,211,78,230,97,238])))return null;
 let p=16;const take=n=>{if(p+n>b.length)throw Error('TRUNCATED');const v=b.subarray(p,p+n);p+=n;return v};
 function read(type){if(type==='pubkey')return encode(take(32));if(type==='u64')return take(8).readBigUInt64LE().toString();if(type==='i64')return take(8).readBigInt64LE().toString();if(type==='u16')return take(2).readUInt16LE();if(type==='bool'){const v=take(1)[0];if(v>1)throw Error('BOOL');return !!v;}if(type==='string'){const n=take(4).readUInt32LE();if(n>128)throw Error('STRING');return take(n).toString('utf8');}if(type.vec){const n=take(4).readUInt32LE();if(n>32)throw Error('VECTOR');return Array.from({length:n},()=>read(type.vec));}if(type.defined)return Object.fromEntries(schema[type.defined.name].map(f=>[f.name,read(f.type)]));throw Error('TYPE');}
 const out={};for(const f of schema.TradeEvent){if(p===b.length)break;out[f.name]=read(f.type);}return out;
 }catch{return null}}
module.exports={tradeEvent};

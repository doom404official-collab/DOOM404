import {PublicKey} from '@solana/web3.js';
const OWNER='TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
// Strict, bounded subset. Unknown binary layouts remain Unknown, never absence.
export function decodeToken2022BinaryMint(account,mint) {
 try {
  const key=x=>typeof x==='string'&&new PublicKey(x).toBase58()===x;
  const owner=account?.owner instanceof PublicKey?account.owner.toBase58():account?.owner;
  if(!key(mint)||owner!==OWNER||account.executable!==false)return null;
  const data=account.data;
  const sdkBuffer=Buffer.isBuffer(data);
  if(!sdkBuffer&&(!Array.isArray(data)||data.length!==2||data[1]!=='base64'||typeof data[0]!=='string'||data[0].length>16384))return null;
  const b=sdkBuffer?Buffer.from(data):Buffer.from(data[0],'base64');
  if(b.length>12288||(!sdkBuffer&&b.toString('base64')!==data[0])||b.length<82||b.length===355||account.space!==undefined&&account.space!==b.length)return null;
  const optional=(offset)=>{const flag=b.readUInt32LE(offset);if(flag>1)throw Error();const bytes=b.subarray(offset+4,offset+36);if(!flag&&bytes.some(x=>x!==0))throw Error();return flag?new PublicKey(bytes).toBase58():null;};
  const info={mintAuthority:optional(0),supply:b.readBigUInt64LE(36).toString(),decimals:b[44],isInitialized:b[45]===1,freezeAuthority:optional(46),extensions:[]};
  if(b[45]!==1)return null;
  if(b.length>82){
   if(b.length<166||b.subarray(82,165).some(x=>x!==0)||b[165]!==1)return null;
   const seen=new Set();let p=166;
   const address=v=>v.every(x=>x===0)?null:new PublicKey(v).toBase58();
   while(p<b.length){
    if(p+4>b.length)return null;
    const type=b.readUInt16LE(p),length=b.readUInt16LE(p+2);p+=4;
    if(seen.has(type)||p+length>b.length)return null;seen.add(type);
    const v=b.subarray(p,p+length);p+=length;
    if(type===1){
     if(length!==108)return null;
     const fee=o=>({epoch:v.readBigUInt64LE(o).toString(),maximumFee:v.readBigUInt64LE(o+8).toString(),transferFeeBasisPoints:v.readUInt16LE(o+16)});
     const older=fee(72),newer=fee(90);
     if(older.transferFeeBasisPoints>10000||newer.transferFeeBasisPoints>10000||BigInt(older.epoch)>BigInt(newer.epoch))return null;
     info.extensions.push({extension:'transferFeeConfig',state:{transferFeeConfigAuthority:address(v.subarray(0,32)),withdrawWithheldAuthority:address(v.subarray(32,64)),withheldAmount:v.readBigUInt64LE(64).toString(),olderTransferFee:older,newerTransferFee:newer}});
    }else if(type===18){
     if(length!==64)return null;
     info.extensions.push({extension:'metadataPointer',state:{authority:address(v.subarray(0,32)),metadataAddress:address(v.subarray(32,64))}});
    }else if(type===19){
     if(length<80||new PublicKey(v.subarray(32,64)).toBase58()!==mint)return null;
     let q=64;const string=()=>{if(q+4>v.length)throw Error();const n=v.readUInt32LE(q);q+=4;if(q+n>v.length)throw Error();const s=new TextDecoder('utf-8',{fatal:true}).decode(v.subarray(q,q+n));q+=n;return s;};
     const state={updateAuthority:address(v.subarray(0,32)),mint,name:string(),symbol:string(),uri:string(),additionalMetadata:[]};
     if(q+4>v.length)return null;const count=v.readUInt32LE(q);q+=4;if(count>length/8)return null;
     for(let i=0;i<count;i++)state.additionalMetadata.push([string(),string()]);
     if(q!==v.length)return null;
     info.extensions.push({extension:'tokenMetadata',state});
    }else return null;
   }
  }
  return {...account,data:{program:'spl-token-2022',parsed:{type:'mint',info}}};
 }catch{return null;}
}

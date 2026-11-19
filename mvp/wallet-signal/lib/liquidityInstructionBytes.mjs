const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function decodeInstructionBytes(data){
 if(data instanceof Uint8Array)return Buffer.from(data);
 if(typeof data!=="string"||data.length===0||data.length>4096)return null;
 let value=0n;
 for(const char of data){
  const digit=alphabet.indexOf(char);
  if(digit<0)return null;
  value=value*58n+BigInt(digit);
 }
 const bytes=[];
 while(value>0n){bytes.push(Number(value&255n));value>>=8n;}
 bytes.reverse();
 const zeros=data.match(/^1*/)?.[0].length??0;
 const result=Buffer.concat([Buffer.alloc(zeros),Buffer.from(bytes)]);
 return result.length<=3072?result:null;
}

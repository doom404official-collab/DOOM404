// Offline review only. No production consumer; derived parsed candidates are not
// authentic jsonParsed RPC records, execution proof, or historical owner evidence.
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SYSTEM='11111111111111111111111111111111';
const TOKENS=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
function decode(s,max){
 if(typeof s!=='string'||s.length<1||s.length>max)return null;
 let n=0n;for(const c of s){const v=alphabet.indexOf(c);if(v<0)return null;n=n*58n+BigInt(v);}
 const a=[];while(n){a.unshift(Number(n&255n));n>>=8n;}
 return Buffer.from([...Array(s.length-s.replace(/^1+/,'').length).fill(0),...a]);
}
function encode(b){
 let n=0n;for(const v of b)n=n*256n+BigInt(v);
 let s='';while(n){s=alphabet[Number(n%58n)]+s;n/=58n;}
 let z=0;while(z<b.length&&b[z]===0)z++;
 return '1'.repeat(z)+s;
}
function denseOwnArray(value,max){
 if(!Array.isArray(value)||value.length>max)return false;
 for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))return false;
 return true;
}
export function previewHolderCompiledInstruction(instruction,accountKeys){
 const unknown=()=>({status:'UNKNOWN',executionVerified:false,sourceKind:'COMPILED_SCHEMA_DERIVATION',candidate:null});
 if(!instruction||typeof instruction!=='object'||Array.isArray(instruction)||
 Object.hasOwn(instruction,'parsed')||Object.hasOwn(instruction,'programId')||
 !denseOwnArray(accountKeys,256)||accountKeys.length<1||
 accountKeys.some(k=>decode(k,44)?.length!==32)||new Set(accountKeys).size!==accountKeys.length)return unknown();
 const validIndex=i=>Number.isInteger(i)&&i>=0&&i<accountKeys.length;
 if(!validIndex(instruction.programIdIndex)||!denseOwnArray(instruction.accounts,4)||
 !instruction.accounts.every(validIndex))return unknown();
 const programId=accountKeys[instruction.programIdIndex],a=instruction.accounts.map(i=>accountKeys[i]);
 const d=decode(instruction.data,72);if(!d)return unknown();
 let type,info,program;
 const exact=(length,count)=>d.length===length&&a.length===count;
 if(programId===SYSTEM){
  program='system';
  if(exact(12,2)&&d.readUInt32LE(0)===2){
   type='transfer';info={source:a[0],destination:a[1],lamports:d.readBigUInt64LE(4).toString()};
  }else if(exact(52,2)&&d.readUInt32LE(0)===0){
   type='createAccount';info={source:a[0],newAccount:a[1],lamports:d.readBigUInt64LE(4).toString(),
    space:d.readBigUInt64LE(12).toString(),owner:encode(d.subarray(20,52))};
  }
 }else if(TOKENS.has(programId)){
  program='spl-token';
  if(d[0]===12&&exact(10,4)){
   type='transferChecked';info={source:a[0],mint:a[1],destination:a[2],authority:a[3],
    tokenAmount:{amount:d.readBigUInt64LE(1).toString(),decimals:d[9]}};
  }else if(d[0]===18&&exact(33,2)){
   type='initializeAccount3';info={account:a[0],mint:a[1],owner:encode(d.subarray(1))};
  }else if(d[0]===17&&exact(1,1)){
   type='syncNative';info={account:a[0]};
  }else if(d[0]===9&&exact(1,3)){
   type='closeAccount';info={account:a[0],destination:a[1],owner:a[2]};
  }else if(d[0]===21&&a.length===1&&(d.length===1||d.length===3&&d[1]===7&&d[2]===0)){
   type='getAccountDataSize';info={mint:a[0],...(d.length===3?{extensionTypes:['immutableOwner']}:{})};
  }else if(d[0]===22&&exact(1,1)){
   type='initializeImmutableOwner';info={account:a[0]};
  }
 }
 if(!type)return unknown();
 return {status:'DERIVED_CANDIDATE',sourceKind:'COMPILED_SCHEMA_DERIVATION',executionVerified:false,
  candidate:{programId,program,parsed:{type,info}}};
}

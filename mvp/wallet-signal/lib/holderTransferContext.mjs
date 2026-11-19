// Conservative transaction-local ownership proof. No current-account lookup.
const TOKEN=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const SYSTEM='11111111111111111111111111111111';
const stableTypes=new Set(['transfer','transferChecked','approve','approveChecked','revoke','mintTo','mintToChecked','burn','burnChecked','freezeAccount','thawAccount','syncNative']);
// Pinned parser/layout contracts and deliberately narrow extension coverage:
// docs/HOLDER_TOKEN_LIFECYCLE_CONTRACT.md. This is not a general binary decoder.
const ancillaryTypes=new Set(['getAccountDataSize','initializeImmutableOwner']);
function ancillary(ix,keys,address){
 const info=ix.parsed?.info,type=ix.parsed?.type;
 let rawType=null,rawAccount=null,rawExtensions=null;
 if(Object.hasOwn(ix,'data')){
  if(typeof ix.data!=='string'||ix.data.length<1||ix.data.length>5)return null;
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;
  for(const c of ix.data){const v=alphabet.indexOf(c);if(v<0)return null;n=n*58n+BigInt(v);}
  const bytes=[];while(n){bytes.unshift(Number(n&255n));n>>=8n;}
  bytes.unshift(...Array(ix.data.length-ix.data.replace(/^1+/,'').length).fill(0));
  if(bytes.length===1&&bytes[0]===22)rawType='initializeImmutableOwner';
  else if(bytes[0]===21&&(bytes.length===1||(bytes.length===3&&bytes[1]===7&&bytes[2]===0))){
   rawType='getAccountDataSize';rawExtensions=bytes.length===3?['immutableOwner']:[];
  }else return null;
  if(!Array.isArray(ix.accounts)||ix.accounts.length!==1)return null;
  rawAccount=ix.accounts[0];
 }
 const kind=type??rawType;
 if(!ancillaryTypes.has(kind)||rawType&&rawType!==kind)return null;
 const field=kind==='getAccountDataSize'?'mint':'account';
 let account=rawAccount;
 if(ix.parsed!==undefined){
  if(!info||typeof info!=='object'||Array.isArray(info))return null;
  const allowed=kind==='getAccountDataSize'?['mint','extensionTypes']:['account'];
  if(Object.keys(info).some(k=>!allowed.includes(k)))return null;
  account=info[field];
  if(rawType&&rawAccount!==account)return null;
  if(kind==='getAccountDataSize'){
   const ext=info.extensionTypes??[];
   if(Object.hasOwn(info,'extensionTypes')&&!Array.isArray(info.extensionTypes))return null;
   if(!Array.isArray(ext)||!(ext.length===0||ext.length===1&&ext[0]==='immutableOwner'))return null;
   if(rawExtensions&&JSON.stringify(ext)!==JSON.stringify(rawExtensions))return null;
  }
 }
 if(!address(account)||!keys.includes(account))return null;
 // Existing address regex alone is insufficient for an exact public-key layout.
 let keyValue=0n;
 for(const c of account)keyValue=keyValue*58n+BigInt('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.indexOf(c));
 let width=account.length-account.replace(/^1+/,'').length;
 while(keyValue){width++;keyValue>>=8n;}
 if(width!==32)return null;
 if(Object.hasOwn(ix,'accounts')&&(!Array.isArray(ix.accounts)||ix.accounts.length!==1||ix.accounts[0]!==account))return null;
 return {kind,account};
}
export function holderTransferContext(tx,signature,address){
 const message=tx.transaction.message, groups=new Map();
 for(const group of tx.meta.innerInstructions){
  if(!Number.isInteger(group.index)||group.index<0||group.index>=message.instructions.length||groups.has(group.index))return null;
  groups.set(group.index,group.instructions);
 }
 const instructions=[];
 message.instructions.forEach((ix,outerInstructionIndex)=>{
  const append=(instruction,innerInstructionIndex)=>instructions.push({ix:instruction,location:{outerInstructionIndex,innerInstructionIndex,
   instructionId:`${signature}:${outerInstructionIndex}:${innerInstructionIndex??'outer'}`,instructionOrder:instructions.length}});
  append(ix,null);(groups.get(outerInstructionIndex)??[]).forEach(append);
 });
 const keys=message.accountKeys.map(k=>typeof k==='string'?k:k?.pubkey),conflicts=new Set(),owners=new Map();
 const balances=name=>{
  const rows=tx.meta[name]??[];if(!Array.isArray(rows))return null;
  const result=new Map();
  for(const b of rows){
   if(!b||!Number.isInteger(b.accountIndex)||b.accountIndex<0||!address(keys[b.accountIndex]))return null;
   const account=keys[b.accountIndex];
   if(result.has(account)||!address(b.owner)||!address(b.mint)||(b.programId!==undefined&&!TOKEN.has(b.programId)))conflicts.add(account);
   result.set(account,b);
  }return result;
 };
 const pre=balances('preTokenBalances'),post=balances('postTokenBalances');if(!pre||!post)return null;
 for(const [account,before] of pre){
  const after=post.get(account);if(!after)continue;
  if(before.owner!==after.owner||before.mint!==after.mint||(before.programId&&after.programId&&before.programId!==after.programId))conflicts.add(account);
  else if(!conflicts.has(account))owners.set(account,{owner:before.owner,mint:before.mint,programId:before.programId??after.programId});
 }
 let opaqueOwnership=false;
 for(const {ix} of instructions){
  if(ancillaryTypes.has(ix?.parsed?.type)||TOKEN.has(ix?.programId)&&ix?.parsed===undefined){
   const known=TOKEN.has(ix?.programId)?ancillary(ix,keys,address):null;
   if(!known){opaqueOwnership=true;continue;}
   if(known.kind==='initializeImmutableOwner')conflicts.add(known.account);
   continue;
  }
  if(!TOKEN.has(ix?.programId)&&ix?.programId!==SYSTEM)continue;
  const type=ix?.parsed?.type,info=ix?.parsed?.info;
  if(typeof type!=='string'||!info){opaqueOwnership=true;continue;}
  if(TOKEN.has(ix.programId)&&!stableTypes.has(type)){
   // Even matching endpoints cannot prove the owner during a lifecycle change.
   if(['setAuthority','closeAccount','initializeAccount','initializeAccount2','initializeAccount3','reallocate'].includes(type)&&address(info.account))conflicts.add(info.account);
   else opaqueOwnership=true;
  }
  if(ix.programId===SYSTEM&&type!=='transfer'){
   const account=info.newAccount??info.account;
   if(['createAccount','createAccountWithSeed','assign','assignWithSeed','allocate','allocateWithSeed'].includes(type)&&address(account))conflicts.add(account);
   else opaqueOwnership=true;
  }
 }
 return {instructions,owners,conflicts,opaqueOwnership};
}

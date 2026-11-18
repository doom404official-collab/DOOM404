// Conservative transaction-local ownership proof. No current-account lookup.
const TOKEN=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const SYSTEM='11111111111111111111111111111111';
const stableTypes=new Set(['transfer','transferChecked','approve','approveChecked','revoke','mintTo','mintToChecked','burn','burnChecked','freezeAccount','thawAccount','syncNative']);
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

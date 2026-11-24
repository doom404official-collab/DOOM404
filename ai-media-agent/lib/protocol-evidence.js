'use strict';
const layouts = require('./protocol-layouts.json');
const AMM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const UNSUPPORTED_ROUTER = 'proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u';
function bytes58(data) {
  if(typeof data !== 'string'||data.length > 4096||!data.length)return null;
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;
  for(const c of data){const v=alphabet.indexOf(c);if(v<0)return null;n=n*58n+BigInt(v)}
  const bytes=[];while(n){bytes.unshift(Number(n&255n));n>>=8n}for(const c of data){if(c!=='1')break;bytes.unshift(0)}return Buffer.from(bytes);
}
const u64=(b,i)=>b.length>=i+8?b.readBigUInt64LE(i).toString():null;
function decodePump(ix) {
 const bytes=bytes58(ix?.data);if(!bytes)return null;const program=ix.programId,accounts=ix.accounts||[];let instruction,roles={},source,minimum=0;
 if(program===AMM_V4){
  instruction={4:'withdraw',9:'swap_base_in',11:'swap_base_out',16:'swap_base_in_v2',17:'swap_base_out_v2'}[bytes[0]];
  if(!instruction||bytes.length<(instruction==='withdraw'?9:17))return null;
  source='https://github.com/raydium-io/raydium-amm/blob/9c54069c6bd86d52cd6622705b98c274ee33ba4a/program/src/instruction.rs';
  // V4 swap account 4 (target orders) is optional; both documented layouts are supported.
  if(instruction==='withdraw'&&accounts.length>=17)roles={pool:accounts[1],authority:accounts[2],vaultA:accounts[6],vaultB:accounts[7],destinationA:accounts[14],destinationB:accounts[15],wallet:accounts[16]};
  else if(instruction.endsWith('_v2')&&accounts.length>=8)roles={pool:accounts[1],authority:accounts[2],vaultA:accounts[3],vaultB:accounts[4],source:accounts[5],destination:accounts[6],wallet:accounts[7]};
  else if(accounts.length===17||accounts.length===18){const o=accounts.length===18?1:0;roles={pool:accounts[1],authority:accounts[2],vaultA:accounts[4+o],vaultB:accounts[5+o],source:accounts[14+o],destination:accounts[15+o],wallet:accounts[16+o]}}
  return {program,protocol:'Raydium AMM V4',instruction,kind:instruction==='withdraw'?'liquidity':'swap',accounts,roles,rawInstructionAmount:u64(bytes,1),source,layoutStatus:Object.keys(roles).length?'OFFICIAL_ACCOUNT_LAYOUT':'ACCOUNT_LAYOUT_UNRESOLVED'};
 }
 const p=layouts[program];if(!p||bytes.length<8)return null;
 const row=Object.entries(p.instructions).find(([,v])=>bytes.subarray(0,8).equals(Buffer.from(v.discriminator)));if(!row)return null;
 const [name,d]=row;if(bytes.length<d.minimumBytes)return null;instruction=name;source=d.source||p.source;minimum=d.accounts.length;
 const a=Object.fromEntries(d.accounts.map((name,i)=>[name,accounts[i]]));
 const pool=a.pool||a.pool_state||a.whirlpool||a.bonding_curve;
 const wallet=a.user||a.payer||a.user_transfer_authority||a.position_authority||a.nft_owner||a.owner||a.token_authority;
 roles={pool,wallet};
 if(p.protocol==='PumpSwap')Object.assign(roles,{vaultA:a.pool_base_token_account,vaultB:a.pool_quote_token_account,destinationA:a.user_base_token_account,destinationB:a.user_quote_token_account});
 if(p.protocol==='Raydium CPMM')Object.assign(roles,instruction==='withdraw'?{authority:a.authority,vaultA:a.token_0_vault,vaultB:a.token_1_vault,destinationA:a.token_0_account,destinationB:a.token_1_account}:{authority:a.authority,vaultA:a.input_vault,vaultB:a.output_vault,source:a.input_token_account,destination:a.output_token_account});
 if(p.protocol==='Raydium CLMM')Object.assign(roles,instruction.startsWith('decrease')?{vaultA:a.token_vault_0,vaultB:a.token_vault_1,destinationA:a.recipient_token_account_0,destinationB:a.recipient_token_account_1}:{vaultA:a.input_vault,vaultB:a.output_vault,source:a.input_token_account,destination:a.output_token_account});
 if(p.protocol==='Orca Whirlpool')Object.assign(roles,{vaultA:a.token_vault_a,vaultB:a.token_vault_b,destinationA:a.token_owner_account_a,destinationB:a.token_owner_account_b});
 if(p.protocol==='Jupiter')Object.assign(roles,{source:a.user_source_token_account||a.source_token_account,destination:a.user_destination_token_account||a.destination_token_account});
 const liquidity=instruction==='withdraw'||instruction.startsWith('decrease_liquidity');
 // A zero-liquidity CLMM decrease can collect fees; it does not prove principal reduction.
 const liquidityRaw=instruction.startsWith('decrease')?(BigInt(u64(bytes,8))+(BigInt(u64(bytes,16))<<64n)).toString():liquidity?u64(bytes,8):null;
 return {program,protocol:p.protocol,instruction,kind:liquidity?'liquidity':'swap',accounts,roles,accountRoles:a,liquidityRaw,rawInstructionAmount:p.protocol==='Jupiter'?null:u64(bytes,8),source,layoutStatus:accounts.length>=minimum?'OFFICIAL_ACCOUNT_LAYOUT':'PARTIAL_ACCOUNT_LAYOUT'};
}
function withdrawalEvidence(t,mint){
 const out=[];if(t?.meta?.err!==null)return out;
 const msg=t.transaction?.message||{},keys=(msg.accountKeys||[]).map(k=>typeof k==='string'?k:k.pubkey),map=new Map(),conflicts=new Set();
 for(const b of [...(t.meta.preTokenBalances||[]),...(t.meta.postTokenBalances||[])]){const key=keys[b.accountIndex];if(!key)continue;const prev=map.get(key);if(prev&&(prev.mint!==b.mint||prev.owner!==b.owner))conflicts.add(key);map.set(key,b)}
 const seen=new Set();for(const group of t.meta.innerInstructions||[]){
  const parent=decodePump(msg.instructions?.[group.index]||{});if(parent?.kind!=='liquidity'||parent.liquidityRaw==='0'||parent.layoutStatus!=='OFFICIAL_ACCOUNT_LAYOUT')continue;
  const roles=parent.roles;if(!roles.pool||![roles.vaultA,roles.vaultB,roles.destinationA,roles.destinationB].every(Boolean))continue;
  for(let i=0;i<(group.instructions||[]).length;i++){
   const x=group.instructions[i],d=x.parsed?.info||{},a=map.get(d.source),b=map.get(d.destination);
   const exact=(d.source===roles.vaultA&&d.destination===roles.destinationA)||(d.source===roles.vaultB&&d.destination===roles.destinationB);
   if(!exact||![TOKEN,TOKEN_2022].includes(x.programId)||!['transfer','transferChecked'].includes(x.parsed?.type)||x.stackHeight!==2||(x.parsed?.type==='transferChecked'&&d.mint!==mint)||a?.mint!==mint||b?.mint!==mint||!b.owner||conflicts.has(d.source)||conflicts.has(d.destination))continue;
   const raw=String(d.tokenAmount?.amount||d.amount);if(!/^\d+$/.test(raw)||BigInt(raw)<=0n)continue;
   if(roles.authority&&d.authority!==roles.authority)continue;
   const key=group.index+':'+i;if(seen.has(key))continue;seen.add(key);
   out.push({instruction:parent.instruction,protocol:parent.protocol,outerIndex:group.index,innerIndex:i,pool:roles.pool,mint,source:d.source,vault:d.source,destination:d.destination,recipient:b.owner,withdrawalAuthority:roles.wallet||null,transferAuthority:d.authority||null,rawAmount:raw,grossRawAmount:raw,netRawAmount:x.programId===TOKEN?raw:null,status:'OFFICIAL_WITHDRAWAL_VAULT_TRANSFER_OBSERVED',authorization:'SUCCESSFUL_PROTOCOL_EXECUTION_WITH_OFFICIAL_ACCOUNT_ROLES',protocolSource:parent.source,limitation:parent.protocol==='Raydium CLMM'?'Transfer may combine reduced principal, accrued fees and rewards; principal amount is not isolated.':x.programId===TOKEN_2022?'Gross Token-2022 transfer; withheld transfer fee and net recipient credit unresolved.':'Gross direct vault transfer; economic purpose and beneficial recipient ownership unresolved.'});
  }
 }
 return out;
}
module.exports={decodePump,withdrawalEvidence,layouts,AMM_V4,UNSUPPORTED_ROUTER,bytes58};

'use strict';
const {decodePump}=require('./protocol-evidence');
const {context,isToken,raw}=require('./sale-reconciliation');
function feeEvidence(t,{signature,creator}={}){
 if(t?.meta?.err!==null)return [];const c=context(t),out=[];
 for(let i=0;i<c.msg.instructions.length;i++){
 const d=decodePump(c.msg.instructions[i]);if(d?.kind!=='fee'||d.layoutStatus!=='OFFICIAL_ACCOUNT_LAYOUT')continue;
 const a=d.accountRoles,ref={signature,slot:t.slot,url:'https://solscan.io/tx/'+signature,protocol:d.protocol,instruction:d.instruction,outerIndex:i,source:d.source};
 if(d.instruction==='collect_coin_creator_fee'){
  if(creator&&a.coin_creator!==creator)continue;
  const rows=t.meta.innerInstructions?.find(g=>g.index===i)?.instructions||[];
  const paid=rows.filter(x=>x.stackHeight===2&&isToken(x)&&['transfer','transferChecked'].includes(x.parsed?.type)&&x.parsed.info.source===a.coin_creator_vault_ata&&x.parsed.info.destination===a.coin_creator_token_account&&x.parsed.info.authority===a.coin_creator_vault_authority&&(!x.parsed.info.mint||x.parsed.info.mint===a.quote_mint)).reduce((n,x)=>n+(raw(x)||0n),0n);
  if(paid>0n&&c.owner(a.coin_creator_vault_ata,a.coin_creator_vault_authority,a.quote_mint)&&c.owner(a.coin_creator_token_account,a.coin_creator,a.quote_mint)&&c.delta(a.coin_creator_token_account)===paid&&c.delta(a.coin_creator_vault_ata)===-paid)out.push({...ref,status:'CREATOR_FEE_COLLECTION_RECONCILED',recipient:a.coin_creator,quoteMint:a.quote_mint,rawAmount:paid.toString()});
  else out.push({...ref,status:'FEE_INSTRUCTION_OBSERVED',limitation:'Collection settlement unresolved.'});
 }else out.push({...ref,status:'FEE_INSTRUCTION_OBSERVED',recipient:a.recipient||a.creator||null,pool:a.pool||null,mint:a.base_mint||null,limitation:'Official fee instruction recognition; not token sale, liquidity principal withdrawal, or verified creator receipt.'});
 }return out;
}
module.exports={feeEvidence};

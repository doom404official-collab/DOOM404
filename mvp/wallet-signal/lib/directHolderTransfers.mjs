import {extractHolderNetworkTransfers} from './holderNetworkTransfers.mjs';
/** One direct holder pair per confirmed signature; snapshot owners are not history. */
export function extractDirectHolderTransfers({transaction,signature,holderWallets=[]}={}){
 const network=extractHolderNetworkTransfers({transaction,signature});
 if(!network.valid)return [];
 const holders=new Set(holderWallets),found=new Map();
 for(const edge of network.transfers){
  if(!holders.has(edge.from)||!holders.has(edge.to))continue;
  const participants=[edge.from,edge.to].sort(),key=participants.join('|');
  if(!found.has(key))found.set(key,{confirmed:true,directInteraction:true,signature,participants,
   kind:edge.assetType==='SOL'?'SOL_TRANSFER':'SPL_TOKEN_TRANSFER',instructionIds:[]});
  found.get(key).instructionIds.push(edge.instructionId);
 }
 return [...found.values()];
}

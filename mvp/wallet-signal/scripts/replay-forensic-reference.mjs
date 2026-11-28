/** Offline acceptance replay of independently retrieved finalized RPC receipts.
 * RPC discovery is replayed; creator identities and events are NOT injected. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {investigateToken} from '../lib/boundedTokenInvestigation.mjs';
const root=new URL('../docs/forensic-ri76-90/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n+'.json',root))).response.result;
const out=[];
for(const name of ['ansem','basket','cate','dcty']){
 const origin=read(name+'-origin');
 // Mint is an explicit fixture input, not a creator identity.
 const mints={ansem:'9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump',basket:'3Tg6YnNrfPdFfsY14MaNsDMWLseAyrUDS3myJtbaJN6f',cate:'Ai66LHZG9MCzg1WKdawwqduVAXpNDUuV8M3uyq5ppump',dcty:'9hjBLBrc7WZW2H8UQvBAvG5WiTZotXUv2Bdcn4f4pump'};
 const history=name==='dcty'?fs.readdirSync(root).filter(n=>/^dcty-history-\d+.json$/.test(n)).map(n=>read(n.slice(0,-5))).sort((a,b)=>a.slot-b.slot||(a.transactionIndex||0)-(b.transactionIndex||0)):[];
 let previous=null;const iterations=name==='dcty'?3:1,requests=[];
 for(let i=0;i<iterations;i++){
  const rpc=async(method,params)=>{requests.push({method,address:params[0]});
   if(method==='getTransactionsForAddress'){
    if(params[0]===mints[name])return {data:[origin],paginationToken:null};
    const offset=params[1].paginationToken?Number(params[1].paginationToken):0;return {data:history.slice(offset,offset+12),paginationToken:offset+12<history.length?String(offset+12):null};
   }
   if(method==='getTokenAccountsByOwner')return read(name+'-current');
   // Holder/liquidity are explicitly outside this creator receipt replay.
   throw Error('OUTSIDE_FORENSIC_CREATOR_FIXTURE_SCOPE');
  };
  previous=await investigateToken({mint:mints[name],rpc,previousObservation:previous,now:()=>Date.parse('2026-11-28T14:00:00Z')});
 }
 assert.ok(previous.creator.attribution?.verified,name+' attribution missing');
 const events=previous.creator.events||[];
 if(name==='dcty'){assert.equal(events.filter(e=>e.acquisitionMechanism==='protocol_holder_reward_distribution').length,26);assert.equal(events.filter(e=>e.acquisitionMechanism==='protocol_holder_reward_distribution').reduce((n,e)=>n+BigInt(e.amountRaw),0n).toString(),'2006484278');}
 out.push({name,mint:mints[name],scope:'Normal investigation pipeline with independent recorded RPC receipts; not a hosted live report',creator:previous.creator.creator,attribution:previous.creator.attribution,events,coverageClaim:null,historyComplete:previous.historyComplete,requestCount:requests.length,observation:{...previous,transactionCache:undefined}});
}
const file=path.join(new URL(root).pathname,'pipeline-replay.json');fs.writeFileSync(file,JSON.stringify(out,null,2));console.log(JSON.stringify(out.map(({name,creator,events,requestCount})=>({name,creator,recoveredEvents:events.length,requestCount}))));

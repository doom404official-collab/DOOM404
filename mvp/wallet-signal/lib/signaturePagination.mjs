// Paginated finalized signature discovery with bounded retries and explicit coverage.
export async function collectSignaturePages({connection,key,pageSize=100,maxPages=3,retries=2}={}) {
 if(!connection||!key||![pageSize,maxPages,retries].every(Number.isInteger)||
   pageSize<1||pageSize>1000||maxPages<1||maxPages>20||retries<0||retries>5)
  throw new TypeError('Invalid signature pagination settings');
 const signatures=[],seen=new Set();
 let before,exhausted=false,failedPage=false;
 for(let page=0;page<maxPages;page++){
  let batch=null;
  for(let attempt=0;attempt<=retries;attempt++){
   try{batch=await connection.getSignaturesForAddress(key,{limit:pageSize,...(before?{before}:{})},'finalized');break;}
   catch(error){if(attempt===retries)failedPage=true;}
  }
  if(!batch)break;
  for(const item of batch)if(!seen.has(item.signature)){seen.add(item.signature);signatures.push(item);}
  if(batch.length<pageSize){exhausted=true;break;}
  const last=batch.at(-1)?.signature;
  if(!last||last===before){failedPage=true;break;}
  before=last;
 }
 return {signatures,coverage:{pagesFetched:Math.ceil(signatures.length/pageSize),
  signaturesRetrieved:signatures.length,historyExhausted:exhausted,failedPage,
  historyComplete:exhausted&&!failedPage}};
}

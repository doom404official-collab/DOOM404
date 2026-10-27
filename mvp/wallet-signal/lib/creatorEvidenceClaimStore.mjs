/** Private-schema PostgreSQL adapter. No connection, credential or environment reads. */
function createStore({enabled=false,client}={},synthetic=false){
 const schema=synthetic?'creator_relay_test_private':'creator_private';
 if(enabled!==true)throw Error('CREATOR_CLAIMS_DISABLED');
 if(typeof client?.query!=='function')throw Error('CREATOR_CLAIMS_CONFIGURATION');
 async function call(name,record,{signal}={}){
  let encoded;try{encoded=JSON.stringify(record);if(!encoded||Buffer.byteLength(encoded)>8192)throw Error();signal?.throwIfAborted();}catch{throw Error('CREATOR_CLAIMS_REJECTED');}
  const isRead=name==='relay_readback';
  if(isRead&&(!Number.isSafeInteger(record.deadlineSeconds)||record.deadlineSeconds<=0))throw Error('CREATOR_CLAIMS_REJECTED');
  try{
   const result=await client.query({text:`SELECT ${schema}.${name}($1::jsonb${isRead?',$2::bigint':''}) AS result`,values:isRead?[encoded,record.deadlineSeconds]:[encoded],signal});
   signal?.throwIfAborted();if(!Array.isArray(result?.rows)||result.rows.length!==1||!Object.hasOwn(result.rows[0],'result'))throw Error();
   const value=result.rows[0].result;
   if(name==='relay_reserve'){if(typeof value!=='boolean')throw Error();}
   else if(value!==null&&(typeof value!=='object'||Array.isArray(value)))throw Error();
   return value;
  }catch{throw Error('CREATOR_CLAIMS_RECONCILIATION_REQUIRED');}
 }
 return Object.freeze({reserve:(r,o)=>call('relay_reserve',r,o),consume:(r,o)=>call('relay_consume',r,o),consumeReadback:(r,o)=>call('relay_readback',r,o)});
}

export const createCreatorEvidenceClaimStore=options=>createStore(options);
export const createCreatorSyntheticEvidenceClaimStore=options=>createStore(options,true);

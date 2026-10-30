import {createCreatorExecutionBudget,assertCreatorSignal} from './creatorExecutionBudget.mjs';
/** Read decoded bytes with a hard bound; never buffer an unbounded text()/json(). */
export async function readCreatorEvidenceBody(message,{maxBytes=1048576,signal}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576)throw Error('CREATOR_BODY_REJECTED');
 const declared=message.headers?.get?.('content-length');
 if(declared!==null&&declared!==undefined&&(!/^(0|[1-9][0-9]*)$/.test(declared)||!Number.isSafeInteger(Number(declared))||Number(declared)>maxBytes))throw Error('CREATOR_BODY_REJECTED');
 if(!message.body?.getReader)throw Error('CREATOR_BODY_REJECTED');
 const reader=message.body.getReader();let total=0;
 try{return await createCreatorExecutionBudget({maxDurationMs:5000}).run('EVIDENCE_BODY',async inner=>{
  const chunks=[];
  while(true){assertCreatorSignal(inner);const item=await reader.read();assertCreatorSignal(inner);if(item.done)break;
   if(!(item.value instanceof Uint8Array)||total+item.value.byteLength>maxBytes)throw Error('CREATOR_BODY_REJECTED');
   total+=item.value.byteLength;chunks.push(Buffer.from(item.value));
  }
  if(declared!==null&&declared!==undefined&&Number(declared)!==total)throw Error('CREATOR_BODY_REJECTED');
  return Buffer.concat(chunks,total);
 },{signal});}catch{throw Error('CREATOR_BODY_REJECTED');}
 finally{try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{} }
}

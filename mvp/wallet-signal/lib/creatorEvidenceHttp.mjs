import {createCreatorEvidenceRelay} from './creatorEvidenceRelay.mjs';
import {readCreatorEvidenceBody} from './creatorEvidenceBody.mjs';
const response=(status,value)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
/** Not imported by any app route. No environment variable activates this factory. */
export function createCreatorEvidenceHttpHandler(options={}){
 if(options.enabled!==true)return async()=>response(404,{status:'DISABLED'});
 const relay=createCreatorEvidenceRelay(options);
 return async request=>{
  try{
   const url=new URL(request.url),paths=['/api/creator-evidence/issue','/api/creator-evidence/upload','/api/creator-evidence/verify'];
   if(request.method!=='POST'||!paths.includes(url.pathname)||url.search)return response(404,{status:'REJECTED'});
   const auth=request.headers.get('authorization');if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_.-]+$/.test(auth)||auth.length>16400)return response(401,{status:'REJECTED'});
   if(request.headers.get('content-type')!=='application/json'||request.headers.has('content-encoding'))return response(415,{status:'REJECTED'});
   const token=auth.slice(7),signal=request.signal;
   await relay.authenticateRequest({action:url.pathname.split('/').at(-1),token,signal});
   const bytes=await readCreatorEvidenceBody(request,{maxBytes:url.pathname.endsWith('/verify')?2:1048576,signal});
   let result;
   if(url.pathname.endsWith('/upload'))result=await relay.upload({token,payload:bytes,capability:request.headers.get('x-creator-capability'),contentType:'application/json',signal});
   else{
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
    if(url.pathname.endsWith('/issue'))result=await relay.issue({token,capture:value,signal});
    else{if(Object.keys(value).length)throw Error();result=await relay.verifyReadback({token,signal});}
   }
   return response(200,result);
  }catch(error){return response(error.message==='CREATOR_RELAY_RECONCILIATION_REQUIRED'?409:400,{status:error.message==='CREATOR_RELAY_RECONCILIATION_REQUIRED'?'RECONCILIATION_REQUIRED':'REJECTED'});}
 };
}

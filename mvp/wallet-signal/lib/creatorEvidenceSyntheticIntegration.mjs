import {createCreatorEvidencePostgres} from './creatorEvidencePostgres.mjs';
// Offline-prepared composition only. No app/workflow imports, env reads or credentials.
import {createCreatorSyntheticEvidenceHttpHandler} from './creatorEvidenceHttp.mjs';
import {createCreatorGithubJwksResolver} from './creatorEvidenceOidc.mjs';
import {createCreatorSyntheticEvidenceClaimStore} from './creatorEvidenceClaimStore.mjs';
import {createCreatorSyntheticEvidenceStorage} from './creatorEvidenceStorage.mjs';
export function createCreatorSyntheticTestIntegration(options={}){
 if(options.enabled!==true)return createCreatorSyntheticEvidenceHttpHandler();
 const {manifest,readManifest,now,claimClients,uploadIdentity,readbackIdentity,publishableKey,fetchImpl=fetch}=options;
 const issuer=createCreatorSyntheticEvidenceClaimStore({enabled:true,client:claimClients?.issuer});
 const consumer=createCreatorSyntheticEvidenceClaimStore({enabled:true,client:claimClients?.consumer});
 const verifier=createCreatorSyntheticEvidenceClaimStore({enabled:true,client:claimClients?.verifier});
 return createCreatorSyntheticEvidenceHttpHandler({enabled:true,manifest,readManifest,now,
  resolveJwks:createCreatorGithubJwksResolver({enabled:true,fetchImpl}),
  claims:{reserve:issuer.reserve,consume:consumer.consume,consumeReadback:verifier.consumeReadback},
  storage:createCreatorSyntheticEvidenceStorage({enabled:true,uploadIdentity,readbackIdentity,publishableKey,fetchImpl})
 });
}

/** Prepared real-driver composition; no active route, environment or credentials. */
export function createCreatorSyntheticRuntimeIntegration(options={}){
 if(options.enabled!==true)return createCreatorSyntheticEvidenceHttpHandler();
 const claimClients=Object.fromEntries(['issuer','consumer','verifier'].map(purpose=>[purpose,
  createCreatorEvidencePostgres({enabled:true,purpose,config:options.postgresConfigs?.[purpose]})]));
 return createCreatorSyntheticTestIntegration({...options,claimClients});
}

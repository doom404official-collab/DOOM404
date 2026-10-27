// Immutable deployment configuration: no caller-controlled window or version renewal.
export const HOLDER_RECOVERY_VERSION_KEYS=Object.freeze({
 'c670f393-31b0-470c-a01f-cb2b813a1219':'GLITCH_HOLDER_RECOVERY_JOB_C670_VERSION',
 'd07c0256-b472-4089-a237-99ed5e5c8cc4':'GLITCH_HOLDER_RECOVERY_JOB_D07_VERSION'
});
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))throw Error('RECOVERY_WINDOW_DISABLED');
 const parsed=Date.parse(value);
 if(!Number.isFinite(parsed)||new Date(parsed).toISOString()!==value)throw Error('RECOVERY_WINDOW_DISABLED');
 return parsed;
}
export function readHolderRecoveryWindow(env=process.env,now=Date.now()){
 const startsAt=instant(env.GLITCH_HOLDER_RECOVERY_START_AT),expiresAt=instant(env.GLITCH_HOLDER_RECOVERY_EXPIRES_AT);
 if(expiresAt<=startsAt||expiresAt-startsAt>20*60*1000||!Number.isFinite(now)||now<startsAt||now>=expiresAt)throw Error('RECOVERY_WINDOW_DISABLED');
 const versions={};
 for(const [job,key] of Object.entries(HOLDER_RECOVERY_VERSION_KEYS)){
  const raw=env[key];
  if(typeof raw!=='string'||!/^(0|[1-9]\d*)$/.test(raw)||raw.length>16)throw Error('RECOVERY_WINDOW_DISABLED');
  const version=Number(raw);
  if(!Number.isSafeInteger(version)||version>Number.MAX_SAFE_INTEGER-3)throw Error('RECOVERY_WINDOW_DISABLED');
  versions[job]=version;
 }
 return Object.freeze({startsAt,expiresAt,versions:Object.freeze(versions)});
}
export function recoveryWindowOpen(window,now=Date.now()){
 return Number.isFinite(now)&&now>=window.startsAt&&now<window.expiresAt;
}

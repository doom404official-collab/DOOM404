/** PNUT-only bounded creator investigation, explicitly opted in.
 * Reuses existing checkpoint engine and strict versioned Pump.fun decoder.
 * Never runs for production or an unrelated Preview branch.
 */
const allowed=process.env.VERCEL_ENV==="preview" &&
 process.env.VERCEL_GIT_COMMIT_REF==="feature/creator-origin-cb02e" &&
 process.env.CREATOR_PNUT_ONCE==="true";
if(!allowed){
 console.log("CREATOR_PNUT_VALIDATION: SKIPPED_NOT_OPTED_IN");
}else{
 process.env.CREATOR_DIAGNOSTIC_MINT="2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump";
 process.env.CREATOR_RESUME_ONCE="true";
 await import("./preview-creator-resume-diagnostic.mjs");
}

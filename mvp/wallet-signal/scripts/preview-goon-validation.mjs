// Preview-only goon investigation. Reuses existing checkpointed scanner.
const enabled = process.env.VERCEL_ENV === "preview"
  && process.env.VERCEL_GIT_COMMIT_REF === "feature/creator-origin-cb02e"
  && process.env.CREATOR_GOON_ONCE === "true";
if (!enabled) {
  console.log("CREATOR_GOON_VALIDATION: SKIPPED_NOT_OPTED_IN");
} else {
  process.env.CREATOR_DIAGNOSTIC_MINT = "HSUMi4rMgjrx7zRUabw3ogGu1pa5hmF2eVcXj9Apump";
  process.env.CREATOR_RESUME_ONCE = "true";
  await import("./preview-creator-resume-diagnostic.mjs");
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/launchpadEvidence.js",import.meta.url),"utf8");
assert.match(source,/LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj/);
assert.match(source,/CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK/);
test("Raydium mint linkage is required and creator remains unverified",()=>{
 assert.match(source,/if \(!accounts\.includes\(mint\)\) continue/);
 assert.match(source,/launchCreator: null, launchCreatorVerified: false, platformVerifiedAsLauncher: false/);
});

/** Existing producer-unit tests inject network and framework boundaries. Keep admission
 * as another explicit injected boundary here; scanner-security and PostgreSQL suites
 * test the real admission implementation separately. This helper never enters app code. */
export function withScannerAdmissionFixture(source){
 return source.replace(/^import \{withScannerAdmission\} from .*;\n/m,'const withScannerAdmission=(request,handler)=>handler(request);\n');
}

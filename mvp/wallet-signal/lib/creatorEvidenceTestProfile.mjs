// Fixed nonhistorical fixture only. No caller-selected profile, bytes or destination.
import {createHash} from 'node:crypto';
export const TEST_OBJECT='relay-tests/creator-auth-flow-v1.json';
export const TEST_TEXT='{"kind":"synthetic-auth-flow-test","version":1,"historicalEvidence":false}\n';
export const TEST_HASH=createHash('sha256').update(TEST_TEXT).digest('hex');
export const TEST_WORKFLOW='creator-evidence-relay-test.yml';
export const TEST_REF='refs/heads/fix/glitch-recovery-preflight-20261027';
export const testBytes=()=>Buffer.from(TEST_TEXT,'utf8');

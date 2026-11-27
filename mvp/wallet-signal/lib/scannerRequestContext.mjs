import {AsyncLocalStorage} from 'node:async_hooks';
const key=Symbol.for('doom404.scanner.admission.context.v1');
export const scannerContext=globalThis[key]||(globalThis[key]=new AsyncLocalStorage());
export class ScannerDenied extends Error{
 constructor(code,status=503,retryAfter=5){super(code);this[Symbol.for('doom404.scanner.denied.v1')]=true;this.code=code;this.status=status;this.retryAfter=Math.max(1,Math.min(86400,Math.ceil(retryAfter)));}
}

export const isScannerDenied=error=>error?.[Symbol.for('doom404.scanner.denied.v1')]===true;

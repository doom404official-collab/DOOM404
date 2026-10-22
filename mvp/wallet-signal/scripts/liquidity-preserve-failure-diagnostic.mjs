import {readFile,writeFile} from 'node:fs/promises';
import {summarizeLiquidityFailure} from '../lib/liquidityFailureDiagnostic.mjs';
const [source,output]=process.argv.slice(2);
if(!source||!output)throw Error('DIAGNOSTIC_SOURCE_OUTPUT_REQUIRED');
await writeFile(output,JSON.stringify(summarizeLiquidityFailure(await readFile(source,'utf8')),null,2),{flag:'wx'});
console.log('LIQUIDITY_FAILURE_DIAGNOSTIC_PREPARED');

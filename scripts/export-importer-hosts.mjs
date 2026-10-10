import {writeFile} from 'node:fs/promises';
import {importerEngineHints,supportedStoreHosts} from '../lib/importer/stores.ts';

// node --experimental-strip-types scripts/export-importer-hosts.mjs [supported-store-hosts.json] [importer-engine-hints.json]
const [output,hintsOutput]=process.argv.slice(2);
const json=JSON.stringify(supportedStoreHosts)+'\n';
if(output)await writeFile(output,json,{encoding:'utf8',mode:0o644});
else process.stdout.write(json);
if(hintsOutput)await writeFile(hintsOutput,JSON.stringify(importerEngineHints())+'\n',{encoding:'utf8',mode:0o644});

import {writeFile} from 'node:fs/promises';
import {supportedStoreHosts} from '../lib/importer/stores.ts';

const output=process.argv[2];
const json=JSON.stringify(supportedStoreHosts)+'\n';
if(output)await writeFile(output,json,{encoding:'utf8',mode:0o644});
else process.stdout.write(json);

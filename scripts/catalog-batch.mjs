import {runCatalogBatch} from '../lib/market/catalog-batch-client.mjs';
import {CatalogRefreshClientError} from '../lib/market/catalog-refresh-client.mjs';
try{console.log(JSON.stringify({event:'atlas_catalog_batch',outcome:'success',...await runCatalogBatch()}))}
catch(error){const known=error instanceof CatalogRefreshClientError?error:undefined;console.error(JSON.stringify({event:'atlas_catalog_batch',outcome:'failure',reasonCode:known?.reasonCode??'unexpected_failure',...(known?.status?{status:known.status}:{})}));process.exitCode=1}

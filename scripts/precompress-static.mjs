import {readdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import zlib from 'node:zlib';

// Hashed build assets (dist/client/_next/static) for the VPS image: brotli q11 and gzip 9 written once at build time
// (3 November 2026). The production server (vinext start, server/static-file-cache.js) finds `<file>.br` / `<file>.gz`
// at boot and answers with `Content-Encoding` and `Vary: Accept-Encoding`, keeping `public, max-age=31536000, immutable`;
// Caddy's `encode` leaves a response that already has `Content-Encoding` alone. No `.zst` is kept: vinext prefers zstd
// over br when a browser accepts both (Chrome), and its build-time zstd is larger than brotli q11 for this JS and CSS.
const brotli=promisify(zlib.brotliCompress),gzip=promisify(zlib.gzip);
const COMPRESSIBLE=new Set(['.js','.mjs','.css','.html','.json','.xml','.svg','.txt','.map','.wasm']);
// The same rule as vinext's isPrecompressedVariantBeneficial: a variant must save more than its extra header bytes.
const HEADER_OVERHEAD={br:45,gzip:47};
const CONCURRENCY=4;

async function* files(directory) {
  let entries;
  try {entries=await readdir(directory,{withFileTypes:true});}
  catch(error) {if(error.code==='ENOENT')return;throw error;}
  for(const entry of entries) {
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())yield* files(full);
    else if(entry.isFile())yield full;
  }
}

async function writeVariant(destination,bytes,originalSize,encoding) {
  if(originalSize-bytes.length<=HEADER_OVERHEAD[encoding]){await rm(destination,{force:true});return 0;}
  const temporary=`${destination}.${process.pid}.tmp`;
  await writeFile(temporary,bytes);
  await rename(temporary,destination);
  return bytes.length;
}

/** Writes `.br` and `.gz` beside every compressible asset under `<clientDir>/_next/static`; returns the byte totals. */
export async function precompressStatic(clientDir) {
  const root=path.join(clientDir,'_next','static'),targets=[];
  for await(const file of files(root)) {
    if(/\.zst$/i.test(file)){await rm(file,{force:true});continue;}
    if(/\.(br|gz)$/i.test(file)||/\.tmp$/i.test(file))continue;
    if(COMPRESSIBLE.has(path.extname(file).toLowerCase()))targets.push(file);
  }
  const totals={files:0,original:0,br:0,gzip:0};
  for(let index=0;index<targets.length;index+=CONCURRENCY) await Promise.all(targets.slice(index,index+CONCURRENCY).map(async file=>{
    const content=await readFile(file);
    const [br,gz]=await Promise.all([
      brotli(content,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11,[zlib.constants.BROTLI_PARAM_SIZE_HINT]:content.length,[zlib.constants.BROTLI_PARAM_MODE]:zlib.constants.BROTLI_MODE_TEXT}}),
      gzip(content,{level:9}),
    ]);
    const [brSize,gzSize]=await Promise.all([writeVariant(file+'.br',br,content.length,'br'),writeVariant(file+'.gz',gz,content.length,'gzip')]);
    totals.files++;totals.original+=content.length;totals.br+=brSize||content.length;totals.gzip+=gzSize||content.length;
  }));
  return totals;
}

if(process.argv[1]?.replaceAll('\\','/').endsWith('/precompress-static.mjs')) {
  const totals=await precompressStatic(path.resolve(process.argv[2]??'dist/client'));
  console.log(`Precompressed ${totals.files} assets: ${totals.original} B → br ${totals.br} B, gzip ${totals.gzip} B`);
}

/** Lossless server-only storage codec. Existing JSON rows remain readable. */
const prefix='atlas.catalog.gzip.v1:';
const manifestFormat='atlas.catalog.chunks.v1';
export const catalogAggregateByteLimit=32_000_000;
const targetChunkBytes=512_000;
const maxChunks=128;
export const catalogStoredByteLimit=1_500_000;
export const catalogDecodedByteLimit=16_000_000;
export class CatalogCapacityError extends Error {
  constructor(){super('Каталог достиг безопасного объёма хранения. Обратитесь к администратору; товары и черновики сохранены.');}
}
export async function encodeCatalogStorage(document:unknown):Promise<string>{
  const json=JSON.stringify(document),size=new TextEncoder().encode(json).length;
  if(size>catalogDecodedByteLimit)throw new CatalogCapacityError();
  if(size<=250_000)return json;
  const compressed=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const parts:string[]=[];
  for(let i=0;i<compressed.length;i+=8192)parts.push(String.fromCharCode(...compressed.subarray(i,i+8192)));
  const encoded=prefix+btoa(parts.join(''));
  // Keep small/incompressible legacy documents as JSON; never exceed the D1 row budget.
  const value=encoded.length<size?encoded:json;
  if(new TextEncoder().encode(value).length>catalogStoredByteLimit)throw new CatalogCapacityError();
  return value;
}
type ChunkLoader=(key:string)=>Promise<string|undefined>;
type CatalogManifest={atlasCatalogStorage:typeof manifestFormat;metadata:Record<string,unknown>;chunks:string[];decodedBytes:number};
const chunkKeyPattern=/^catalog\.chunk\.[a-f0-9]{32}\.\d{1,3}$/;
export function catalogStorageChunkKeys(value:string):string[]{
  if(!value.startsWith('{"atlasCatalogStorage":'))return [];
  if(new TextEncoder().encode(value).length>catalogStoredByteLimit)throw new CatalogCapacityError();
  const parsed=JSON.parse(value) as Partial<CatalogManifest>;
  if(parsed.atlasCatalogStorage!==manifestFormat||!Array.isArray(parsed.chunks)||!parsed.chunks.length||parsed.chunks.length>maxChunks||parsed.chunks.some(key=>typeof key!=='string'||!chunkKeyPattern.test(key))||new Set(parsed.chunks).size!==parsed.chunks.length)throw new Error('Invalid catalog storage manifest.');
  const generation=parsed.chunks[0].slice(0,parsed.chunks[0].lastIndexOf('.')+1);
  if(parsed.chunks.some(key=>!key.startsWith(generation)))throw new Error('Mixed catalog storage generations.');
  return parsed.chunks;
}
/** Large snapshots are split at entry boundaries: a reader parses each chunk only once. */
export async function prepareCatalogStorage(document:unknown):Promise<{value:string;chunks:{key:string;value:string}[]}>{
  if(!document||typeof document!=='object'||!Array.isArray((document as {entries?:unknown}).entries))throw new Error('Invalid catalog document.');
  const {entries,...metadata}=document as {entries:unknown[];[key:string]:unknown};
  let decodedBytes=new TextEncoder().encode(JSON.stringify({...metadata,entries:[]})).length;
  const entrySizes=entries.map(entry=>new TextEncoder().encode(JSON.stringify(entry)).length);
  decodedBytes+=entrySizes.reduce((sum,size)=>sum+size,0)+Math.max(0,entries.length-1);
  if(decodedBytes>catalogAggregateByteLimit)throw new CatalogCapacityError();
  if(decodedBytes<=1_000_000)return {value:await encodeCatalogStorage(document),chunks:[]};
  const generation=crypto.randomUUID().replaceAll('-',''),chunks:{key:string;value:string}[]=[];
  let group:unknown[]=[],size=0;
  const flush=async()=>{if(!group.length)return;if(chunks.length>=maxChunks)throw new CatalogCapacityError();chunks.push({key:`catalog.chunk.${generation}.${chunks.length}`,value:await encodeCatalogStorage({entries:group})});group=[];size=0;};
  for(let index=0;index<entries.length;index++){
    if(group.length&&size+entrySizes[index]>targetChunkBytes)await flush();
    group.push(entries[index]);size+=entrySizes[index]+1;
  }
  await flush();
  const value=JSON.stringify({atlasCatalogStorage:manifestFormat,metadata,chunks:chunks.map(chunk=>chunk.key),decodedBytes} satisfies CatalogManifest);
  if(new TextEncoder().encode(value).length>catalogStoredByteLimit)throw new CatalogCapacityError();
  return {value,chunks};
}
export async function decodeCatalogStorage(value:string,loadChunk?:ChunkLoader):Promise<unknown>{
  const keys=catalogStorageChunkKeys(value);
  if(keys.length){
    if(!loadChunk)throw new Error('Catalog storage requires its chunk loader.');
    if(new TextEncoder().encode(value).length>catalogStoredByteLimit)throw new CatalogCapacityError();
    const manifest=JSON.parse(value) as CatalogManifest;
    if(!manifest.metadata||typeof manifest.metadata!=='object'||Array.isArray(manifest.metadata)||'entries' in manifest.metadata||!Number.isSafeInteger(manifest.decodedBytes)||manifest.decodedBytes<0||manifest.decodedBytes>catalogAggregateByteLimit)throw new Error('Invalid catalog storage manifest.');
    const entries:unknown[]=[];
    let decodedBytes=new TextEncoder().encode(JSON.stringify({...manifest.metadata,entries:[]})).length;
    for(const key of keys){
      const stored=await loadChunk(key);if(stored===undefined)throw new Error('Catalog storage chunk is missing.');
      if(catalogStorageChunkKeys(stored).length)throw new Error('Nested catalog storage manifest.');
      const part=await decodeCatalogStorage(stored) as {entries?:unknown};
      if(!part||typeof part!=='object'||!Array.isArray(part.entries))throw new Error('Invalid catalog storage chunk.');
      if(entries.length+part.entries.length>2000)throw new CatalogCapacityError();
      for(const entry of part.entries){decodedBytes+=new TextEncoder().encode(JSON.stringify(entry)).length+(entries.length?1:0);if(decodedBytes>catalogAggregateByteLimit)throw new CatalogCapacityError();entries.push(entry);}
    }
    if(decodedBytes!==manifest.decodedBytes)throw new Error('Catalog storage size mismatch.');
    return {...manifest.metadata,entries};
  }
  if(!value.startsWith(prefix)){
    if(new TextEncoder().encode(value).length>catalogDecodedByteLimit)throw new CatalogCapacityError();
    return JSON.parse(value);
  }
  if(new TextEncoder().encode(value).length>catalogStoredByteLimit)throw new CatalogCapacityError();
  const bytes=Uint8Array.from(atob(value.slice(prefix.length)),char=>char.charCodeAt(0));
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoder=new TextDecoder(),parts:string[]=[];let size=0;
  try{
    for(;;){const {done,value:chunk}=await reader.read();if(done)break;
      size+=chunk.byteLength;if(size>catalogDecodedByteLimit){await reader.cancel();throw new CatalogCapacityError();}
      parts.push(decoder.decode(chunk,{stream:true}));
    }
    parts.push(decoder.decode());return JSON.parse(parts.join(''));
  }finally{reader.releaseLock();}
}

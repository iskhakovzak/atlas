/** Lossless server-only storage codec. Existing JSON rows remain readable. */
const prefix='atlas.catalog.gzip.v1:';
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
export async function decodeCatalogStorage(value:string):Promise<unknown>{
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

import {failure,HttpError} from '@/lib/market/server';
import {publicCatalogProduct} from '@/lib/market/initial-data';
import {publicCatalogCache} from '@/lib/market/catalog-list';

/**
 * One published catalog product in full — options, gallery, colour galleries, description — for its sheet
 * (3 November 2026): the public list (GET /api/catalog) leaves those out (lib/market/catalog-list.ts). Read exactly as the
 * list and the product page read the catalog (lib/market/initial-data.ts publicCatalogProduct), the same for every
 * visitor, so it is cached like the list. 404 for an id the catalog does not publish.
 */
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
  const raw=(await params).id??'';
  // Catalog ids are plain ("find-<uuid>"); an escaped one is read as the product page reads it.
  let id=raw;try{id=decodeURIComponent(raw)}catch{/* kept as sent */}
  const found=id&&id.length<=200?await publicCatalogProduct(id):null;
  if(!found)throw new HttpError(404,'Товар каталога не найден.');
  return Response.json({product:found.product},{headers:{'Cache-Control':publicCatalogCache}});
}catch(error){return failure(error,request)}}

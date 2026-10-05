'use client';

import {parseMrzText,type MrzFields} from '@/lib/market/mrz';

/** A phone photo (HEIC from an iPhone, or a very large JPEG/PNG) becomes a JPEG of at most 2400px; PDFs pass through. */
export async function normalizeDocument(file:File):Promise<File>{
 if(file.type==='application/pdf')return file;
 const heic=/hei[cf]/i.test(file.type)||/\.hei[cf]$/i.test(file.name);
 if(!heic&&file.size<4_000_000&&(file.type==='image/jpeg'||file.type==='image/png'))return file;
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
 return blob?new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}):file;
}

function crop(bitmap:ImageBitmap,fromTop:number){
 const scale=Math.min(1,2000/bitmap.width),sy=Math.round(bitmap.height*fromTop),sh=bitmap.height-sy;
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(sh*scale);
 const context=canvas.getContext('2d')!;context.filter='grayscale(1) contrast(1.4)';
 context.drawImage(bitmap,0,sy,bitmap.width,sh,0,0,canvas.width,canvas.height);
 return canvas;
}

/**
 * Reads the machine-readable zone of a passport or an ID card from a photo, in the browser: Tesseract.js runs
 * from /ocr/ (no third-party service sees the document). The bottom part of the photo is tried first, then all of it.
 */
export async function readDocument(file:File,inspect?:(text:string)=>void):Promise<MrzFields>{
 if(!file.type.startsWith('image/'))return {};
 const {createWorker,PSM}=await import('tesseract.js');
 const worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/',langPath:'/ocr/',gzip:true});
 const bitmap=await createImageBitmap(file);
 try{
  await worker.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
  for(const fromTop of [.5,0]){
   const {data}=await worker.recognize(crop(bitmap,fromTop));
   inspect?.(data.text);
   const fields=parseMrzText(data.text);
   if(fields.passportNumber||fields.lastName)return fields;
  }
  return {};
 }finally{bitmap.close();await worker.terminate()}
}

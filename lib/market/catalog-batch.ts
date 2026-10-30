import {z} from 'zod';
export const batchOutcomeSchema=z.object({url:z.string().max(3000),status:z.enum(['saved','failed']),manual:z.boolean().optional(),id:z.string().optional(),published:z.boolean().optional(),note:z.string().optional(),reason:z.string().optional(),importFailureReason:z.string().optional(),storeReadMs:z.number().int().nonnegative().optional()});
export const batchJobSchema=z.object({id:z.string(),status:z.enum(['running','paused','completed']),urls:z.array(z.string().max(3000)).max(500),collectionIds:z.array(z.string().max(80)).max(20),country:z.string().max(80),results:z.array(batchOutcomeSchema).max(500),leaseId:z.string().optional(),leaseUntil:z.number(),updatedAt:z.number(),principal:z.object({email:z.string().max(320),method:z.string().max(40)}).optional()});
export type CatalogBatchJob=z.infer<typeof batchJobSchema>;

export function finalizeBatch(job:CatalogBatchJob,results:z.infer<typeof batchOutcomeSchema>[],now:number){
 const expected=job.urls.slice(job.results.length,job.results.length+10);
 if(!results.length||results.length!==expected.length||results.some((item,index)=>item.url!==expected[index]))throw new Error('Результаты импорта неполные; задание будет повторено.');
 const next:CatalogBatchJob={...job,results:[...job.results,...results],leaseUntil:0,leaseId:undefined,updatedAt:now};
 if(next.results.length>=next.urls.length)next.status='completed';
 return next;
}

/** Do not return the server-recorded identity as part of an admin job response. */
export function publicBatchJob(job:CatalogBatchJob|undefined){if(!job)return undefined;const {principal,...visible}=job;void principal;return visible;}

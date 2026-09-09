import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {blank,parseState,type State} from './domain';
export function database(){if(!env.DB)throw Error('Серверное хранилище пока недоступно.');return env.DB}
export async function identity(){const user=await getChatGPTUser();if(!user)throw new HttpError(401,'Войдите, чтобы продолжить.');return user}
export function operator(email:string){return !!env.ATLAS_OPERATOR_EMAIL&&email.toLowerCase()===env.ATLAS_OPERATOR_EMAIL.toLowerCase()}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new HttpError(403,'Недопустимый источник запроса.')}
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function account(user:{userId:string;displayName:string}){const now=Date.now(),db=database();await db.prepare('INSERT OR IGNORE INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(user.userId,user.displayName,JSON.stringify(blank()),now,now).run();const row=await db.prepare('SELECT name,state,revision,created_at FROM market_accounts WHERE user_id=?').bind(user.userId).first<{name:string;state:string;revision:number;created_at:number}>();if(!row)throw Error('Account unavailable');return {...row,state:parseState(row.state)}}
export async function persist(id:string,state:State,revision:number){if(JSON.stringify(state).length>1000000)throw new HttpError(413,'Достигнут лимит данных тестового профиля.');const result=await database().prepare('UPDATE market_accounts SET state=?, revision=revision+1, updated_at=? WHERE user_id=? AND revision=?').bind(JSON.stringify(state),Date.now(),id,revision).run();if(!result.meta.changes)throw new HttpError(409,'Заказ изменился в другой вкладке. Данные обновлены — повторите действие.');}
export function failure(error:unknown){if(error instanceof HttpError)return json({error:error.message},error.status);return json({error:'Не удалось выполнить запрос. Попробуйте ещё раз.'},503)}

export async function requestJson(request:Request,maxBytes=1100000):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Пустой запрос.');
 let text='',size=0;const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'Слишком большой запрос.')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();try{return JSON.parse(text)}catch{throw new HttpError(400,'Некорректный JSON.')}
}

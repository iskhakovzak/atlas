import {HttpError} from '@/lib/market/server';
import {AuthError} from './server';

export function authJson(body:unknown,status=200,setCookie?:string|string[]){
 const response=Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 for(const value of [setCookie??[]].flat())response.headers.append('Set-Cookie',value);
 return response;
}

// Auth routes return stable machine codes; the login screen localizes them.
export function authFailure(error:unknown){
 if(error instanceof AuthError)return authJson({error:error.code},error.status);
 if(error instanceof HttpError)return authJson({error:error.status===403?'forbidden_origin':'bad_request'},error.status);
 console.error('Sign-in request failed',error);
 return authJson({error:'unavailable'},503);
}

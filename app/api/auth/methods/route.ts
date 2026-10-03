import {authMethods} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';

export async function GET(request:Request){try{return authJson(authMethods(request))}catch(error){return authFailure(error)}}

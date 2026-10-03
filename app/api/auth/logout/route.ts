import {sameOrigin} from '@/lib/market/server';
import {endSession} from '@/lib/auth/server';
import {authFailure,authJson} from '@/lib/auth/http';

export async function POST(request:Request){try{
 sameOrigin(request);
 return authJson({ok:true},200,await endSession(request));
}catch(error){return authFailure(error)}}

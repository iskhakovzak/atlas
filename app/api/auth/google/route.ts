import {startGoogle} from '@/lib/auth/server';
import {loginPath,safeReturnTo} from '@/lib/auth/return-to';

export async function GET(request:Request){
 try{return await startGoogle(request)}
 catch(error){
  console.error('Google sign-in start failed',error);
  const returnTo=safeReturnTo(new URL(request.url).searchParams.get('return_to'));
  return new Response(null,{status:303,headers:{Location:loginPath(returnTo)+'&error=google','Cache-Control':'no-store'}});
 }
}

import {finishGoogle} from '@/lib/auth/server';
import {loginPath} from '@/lib/auth/return-to';

export async function GET(request:Request){
 try{return await finishGoogle(request)}
 catch(error){
  console.error('Google sign-in callback failed',error);
  return new Response(null,{status:303,headers:{Location:loginPath('/')+'&error=google','Cache-Control':'no-store'}});
 }
}

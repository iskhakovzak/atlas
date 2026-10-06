import {finishApple} from '@/lib/auth/server';
import {loginPath} from '@/lib/auth/return-to';

// Apple's form_post lands here cross-site; the state cookie (__Host-atlas_apple, SameSite=None) ties it to the browser.
export async function POST(request:Request){
 try{return await finishApple(request)}
 catch(error){
  console.error('Apple sign-in callback failed',error);
  return new Response(null,{status:303,headers:{Location:loginPath('/')+'&error=apple','Cache-Control':'no-store'}});
 }
}

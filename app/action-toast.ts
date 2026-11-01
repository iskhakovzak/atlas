import type {State} from '@/lib/market/domain';
import type {Locale} from '@/lib/market/i18n';
import {nextStepOf} from '@/lib/market/next-step';
import {actionToastOf} from '@/lib/market/action-copy';
import {toast} from '@/lib/market/toast';

/**
 * The one gentle toast after sign-in when something waits (owner, 1 November 2026): «Добавьте паспорт для заказа Nike —
 * нужно для таможни» with its action. Its own chunk, loaded by the shell only right after a sign-in (app/marketplace.tsx).
 */
export function showActionToast(state:State,locale:Locale,go:(href:string)=>void){
 const shown=actionToastOf(nextStepOf(state),locale);
 if(!shown)return;
 toast.message(shown.text,{id:'atlas-action-needed',duration:9000,action:{label:shown.action,onClick:()=>go(shown.href)}});
}

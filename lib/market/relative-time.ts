// "How long ago" for operator lists (support threads, queues) in the screen language: minutes, hours, then days.
// The Russian-only `ago()` in app/admin-shared.ts stays for the tables that are Russian anyway.
import {pickLocale} from './uz-cyrl.ts';

const agoWords=/*@__PURE__*/{
 ru:{now:'только что',min:(n:number)=>`${n} мин назад`,hour:(n:number)=>`${n} ч назад`,day:(n:number)=>`${n} дн. назад`},
 uz:{now:'hozirgina',min:(n:number)=>`${n} daqiqa oldin`,hour:(n:number)=>`${n} soat oldin`,day:(n:number)=>`${n} kun oldin`},
 en:{now:'just now',min:(n:number)=>`${n} min ago`,hour:(n:number)=>`${n} h ago`,day:(n:number)=>`${n} d ago`},
};

/** "5 мин назад" / "3 soat oldin" / "4 d ago"; a time in the future reads as "just now". */
export function agoLocalized(at:number,locale:string,now:number){
 const words=pickLocale(agoWords,locale);
 const minutes=Math.max(0,Math.floor((now-at)/60000));
 if(minutes<1)return words.now;
 if(minutes<60)return words.min(minutes);
 const hours=Math.round(minutes/60);
 if(hours<48)return words.hour(hours);
 return words.day(Math.round(hours/24));
}

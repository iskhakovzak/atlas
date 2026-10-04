export const maximumBoxedWeight=49.5;
export const weightCategories=['Обувь','Одежда','Электроника','Аксессуары','Красота и уход','Дом и быт','Спорт','Другое'];

// Typical weight of one item in its retail box, when the store does not publish one. These are editable
// estimates: the warehouse weighs every parcel and the international delivery reserve covers the difference.
const boxedWeightEstimates:Record<string,number>={
  'Обувь':1.2,
  'Одежда':0.6,
  'Электроника':1,
  'Аксессуары':0.5,
  'Красота и уход':0.4,
  'Дом и быт':1.5,
  'Спорт':1,
  'Другое':1,
};

// A product title often names the kind of item more precisely than the category ("boots", "t-shirt").
// The first matching rule wins, so heavier and more specific kinds come first.
const titleEstimates:[RegExp,number][]=[
  [/\b(laptop|notebook|macbook)\b|ноутбук/i,2.8],
  [/\b(monitor|printer)\b|монитор|принтер/i,6],
  [/\b(boots?|uggs?|timberland)\b|ботин|сапог|угги/i,1.8],
  [/\b(coat|parka|puffer|down jacket)\b|пуховик|пальто|парка/i,1.5],
  [/\b(backpack|suitcase|luggage)\b|рюкзак|чемодан/i,1.2],
  [/\b(jacket|hoodie|sweatshirt|sweater|fleece)\b|куртк|худи|толстовк|свитер/i,0.9],
  [/\b(sneakers?|trainers?|running shoes?|shoes?)\b|кроссовк|кеды|туфл/i,1.2],
  [/\b(jeans|pants|trousers|joggers)\b|джинс|брюк|штан/i,0.8],
  [/\b(sandals?|slides?|flip.?flops?|slippers?)\b|сандал|шлеп|тапочк/i,0.7],
  [/\b(tablet|ipad|console|playstation|xbox|nintendo)\b|планшет|приставк/i,1.2],
  [/\b(headphones?|earbuds?|airpods|speaker)\b|наушник|колонк/i,0.6],
  [/\b(phone|iphone|smartphone|galaxy)\b|смартфон|телефон/i,0.6],
  [/\b(t-?shirt|tee|polo|tank top|shorts|leggings|dress|skirt|shirt)\b|футболк|майк|шорт|леггинс|плать|юбк|рубашк/i,0.4],
  [/\b(bag|handbag|tote|purse)\b|сумк/i,0.8],
  [/\b(watch|smartwatch)\b|часы/i,0.4],
  [/\b(perfume|eau de (parfum|toilette)|fragrance)\b|духи|парфюм/i,0.5],
  [/\b(socks?|underwear|briefs|cap|hat|beanie|gloves|scarf|wallet|belt)\b|носк|бель|кепк|шапк|перчат|шарф|кошел|ремень/i,0.3],
  [/\b(cream|serum|lipstick|mascara|cleanser|lotion|shampoo)\b|крем|сыворот|помад|тушь|шампун/i,0.3],
  [/\b(vitamins?|supplements?|capsules|protein)\b|витамин|бад|протеин/i,0.5],
];

export function validBoxedWeight(value:unknown){
  const weight=typeof value==='number'?value:Number(value);
  return Number.isFinite(weight)&&weight>0&&weight<=maximumBoxedWeight?Math.round(weight*1000)/1000:undefined;
}

export function estimatedBoxedWeight(category:string){
  return boxedWeightEstimates[category]??boxedWeightEstimates['Другое'];
}

/** Editable estimate of one boxed item: by the kind of item named in the title, else by category. */
export function estimateBoxedWeight(category:string,title=''):{kg:number;basis:'title'|'category'}{
  const rule=title?titleEstimates.find(([pattern])=>pattern.test(title)):undefined;
  return rule?{kg:rule[1],basis:'title'}:{kg:estimatedBoxedWeight(category),basis:'category'};
}

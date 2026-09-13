export const maximumBoxedWeight=49.5;
export const weightCategories=['Обувь','Одежда','Электроника','Аксессуары','Красота и уход','Дом и быт','Спорт','Другое'];

const boxedWeightEstimates:Record<string,number>={
  'Обувь':1.7,
  'Одежда':1,
  'Электроника':1.4,
  'Аксессуары':1,
  'Красота и уход':0.8,
  'Дом и быт':2.5,
  'Спорт':2,
  'Другое':2,
};

export function validBoxedWeight(value:unknown){
  const weight=typeof value==='number'?value:Number(value);
  return Number.isFinite(weight)&&weight>0&&weight<=maximumBoxedWeight?Math.round(weight*1000)/1000:undefined;
}

export function estimatedBoxedWeight(category:string){
  return boxedWeightEstimates[category]??boxedWeightEstimates['Другое'];
}

/** Official adidas men's footwear chart; never apply Nike conversions to adidas.
 * https://support.dtb.adidas.com/static-content/size-charts/en_GB/footwear/size-shoes.html */
const us='4|4.5|5|5.5|6|6.5|7|7.5|8|8.5|9|9.5|10|10.5|11|11.5|12|12.5|13|13.5|14|14.5|15|16|17|18|19|20'.split('|');
const uk='3.5|4|4.5|5|5.5|6|6.5|7|7.5|8|8.5|9|9.5|10|10.5|11|11.5|12|12.5|13|13.5|14|14.5|15|16|17|18|19'.split('|');
const eu='36|36 2/3|37 1/3|38|38 2/3|39 1/3|40|40 2/3|41 1/3|42|42 2/3|43 1/3|44|44 2/3|45 1/3|46|46 2/3|47 1/3|48|48 2/3|49 1/3|50|50 2/3|51 1/3|52 2/3|53 1/3|54 2/3|55 2/3'.split('|');
export function adidasMenSize(brand:string,title:string,size:string){
  if(!/^adidas$/i.test(brand.trim())||! /\bmen(?:['’]s)?\b/i.test(title))return;
  const index=us.indexOf(size);if(index<0)return;
  return {us:us[index],uk:uk[index],eu:eu[index]};
}

import type { Product } from './domain.ts';
import {communityCatalogProducts} from './community-deals.ts';

// Editorial snapshots from the linked official US product pages, not an inventory feed.
// Prices/options must be fetched and confirmed in the link-order flow before checkout.
export type MerchantFind = Product & { store: string; observedOn: string; referenceUsd?: number; collectionIds?: string[] };
const estimate = { country: 'США', sourceCurrency: 'USD', sourceShippingUsd: 10, sourceShipping: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: false, weightOrigin: 'Оценка Atlas; уточняется перед оформлением', variants: ['Уточнить вариант в магазине'], sourceExpiresAt: Date.parse('2026-09-19T00:00:00Z') };
export const merchantFinds: MerchantFind[] = [
  {
    ...estimate, id: 'nike-club-fn3859-657', name: 'Nike Club · Fleece Hoodie', brand: 'Nike', store: 'Nike', category: 'Одежда',
    usd: 49.97, sourcePrice: 49.97, boxedWeight: 1, weight: 1.5,
    sourceUrl: 'https://www.nike.com/t/club-mens-pullover-fleece-hoodie-00eeWNwD/FN3859-657',
    image: 'https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto%2Cu_9ddf04c7-2a9a-4d76-add1-d15af8f0263d%2Cc_scale%2Cfl_relative%2Cw_1.0%2Ch_1.0%2Cfl_layer_apply/2af74814-9b8c-44c3-8ba9-d08ef0fe0ca1/M%2BNK%2BCLUB%2BBB%2BPO%2BHOODIE.png',
    observedOn: '2026-09-11', description: 'Худи из флиса с капюшоном и карманом. Цвет University Red, артикул FN3859-657. Цена конкретного размера проверяется перед оформлением.',
  },
  {
    ...estimate, id: 'apple-airtag-1pack-2026', name: 'Apple AirTag · 1 pack', brand: 'Apple', store: 'Apple', category: 'Электроника',
    usd: 29, sourcePrice: 29, boxedWeight: 0.25, weight: 1,
    sourceUrl: 'https://www.apple.com/shop/buy-airtag/airtag/1-pack',
    image: 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airtag-1pack-select-202601?wid=890&hei=740&fmt=jpeg&qlt=90&.v=1767653157724',
    observedOn: '2026-09-11', description: 'Одна метка AirTag для поиска вещей через приложение «Локатор». Проверьте совместимость с вашим устройством Apple и ограничения на перевозку батарей.',
  },
  {
    ...estimate, id: 'nike-gato-ih3587-400', name: 'Nike Gato LV8', brand: 'Nike', store: 'Nike', category: 'Обувь',
    usd: 73.97, sourcePrice: 73.97, referenceUsd: 125, boxedWeight: 1.7, weight: 2.2,
    sourceUrl: 'https://www.nike.com/t/gato-lv8-mens-shoes-Ib4M9R5k/IH3587-400',
    image: 'https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto%2Cu_9ddf04c7-2a9a-4d76-add1-d15af8f0263d%2Cc_scale%2Cfl_relative%2Cw_1.0%2Ch_1.0%2Cfl_layer_apply/2262c689-289d-4cf1-a229-77ee9a6f7ae1/NIKE%2BGATO%2BLV8.png',
    observedOn: '2026-09-11', description: 'Модель с джинсовым верхом в цвете Light Armory Blue. Артикул IH3587-400. Размер и наличие уточняются на странице Nike.',
  },
  {
    ...estimate, id: 'nike-cortez-dm4044-108', name: 'Nike Cortez Leather', brand: 'Nike', store: 'Nike', category: 'Обувь',
    usd: 76.97, sourcePrice: 76.97, referenceUsd: 95, boxedWeight: 1.7, weight: 2.2,
    sourceUrl: 'https://www.nike.com/t/cortez-leather-mens-shoes-SxhPXX/DM4044-108',
    image: 'https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto%2Cu_9ddf04c7-2a9a-4d76-add1-d15af8f0263d%2Cc_scale%2Cfl_relative%2Cw_1.0%2Ch_1.0%2Cfl_layer_apply/db838aa6-9440-4e42-adf5-81b9141aec37/NIKE%2BCORTEZ.png',
    observedOn: '2026-09-11', description: 'Кожаные кроссовки White / Varsity Blue / Varsity Red. Артикул DM4044-108. Размер и наличие уточняются на странице Nike.',
  },
  {
    ...estimate, id: 'anker-nano-a2147113', name: 'Anker Nano Charger · 30W', brand: 'Anker', store: 'Anker', category: 'Электроника',
    usd: 15.99, sourcePrice: 15.99, boxedWeight: 0.35, weight: 1,
    sourceUrl: 'https://www.anker.com/products/a2147?variant=42089534750870',
    image: 'https://cdn.shopify.com/s/files/1/0493/9834/9974/files/SKU-04-Phantom_Black.png?v=1764228261',
    observedOn: '2026-09-11', description: 'Компактное зарядное устройство USB-C, 30 Вт, Phantom Black. Американская версия: проверьте тип вилки перед оформлением.',
  },
];

export const bundledMerchantFinds: MerchantFind[] = [...merchantFinds, ...communityCatalogProducts];

export function merchantRecord(product: Product) {
  return bundledMerchantFinds.find(item => item.id === product.id && item.sourceUrl === product.sourceUrl && item.usd === product.usd);
}
export function catalogFreshness(product: Product, now = Date.now()) {
  const expiresAt = product.sourceExpiresAt ?? 0;
  if (!expiresAt || now >= expiresAt) return 'expired' as const;
  if (expiresAt - now < 48 * 60 * 60 * 1000) return 'due' as const;
  return 'fresh' as const;
}
export function visibleMerchantFinds(now = Date.now()) {
  return merchantFinds.filter((product) => catalogFreshness(product, now) !== 'expired');
}
export function findOrderUrl(product: Product) {
  const deal = communityCatalogProducts.find(item => item.id === product.id && item.sourceUrl === product.sourceUrl);
  return '/order-by-link?url=' + encodeURIComponent(product.sourceUrl ?? '') + (deal ? '&deal=' + encodeURIComponent(deal.id) : '');
}

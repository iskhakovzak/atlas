import type { Product } from './domain.ts';

export type CommunityDealCategory = 'Одежда' | 'Обувь' | 'Красота' | 'Техника' | 'Дом';

export type CommunityDeal = {
  id: string;
  title: string;
  store: string;
  category: CommunityDealCategory;
  price: number;
  referencePrice: number;
  image: string;
  url: string;
  observedOn: string;
};

// Dated editorial observations presented as a direct-to-merchant discovery shelf.
// They are not Atlas inventory. Card totals use a conservative chargeable-weight
// estimate and the standard unknown-store-shipping reserve; protected import
// rechecks the product before the customer can continue.
export const communityDeals: CommunityDeal[] = [
  { id: 'merrell-wrapt', title: 'Merrell Wrapt Sneaker', store: 'Merrell', category: 'Обувь', price: 74.99, referencePrice: 125, observedOn: '2026-09-13', url: 'https://www.merrell.com/US/en/wrapt-sneaker/60644M.html', image: 'https://thekit.wolverineworldwide.com/match/media_lookup/MRLM-J00005167-091225-F26-000/?preset=dw-large' },
  { id: 'brooks-revel-7', title: 'Brooks Revel 7 Running Shoes', store: 'Brooks', category: 'Обувь', price: 59.99, referencePrice: 99.99, observedOn: '2026-09-13', url: 'https://www.brooksrunning.com/en_us/mens/shoes/road-running-shoes/revel-7/110435.html', image: 'https://www.brooksrunning.com/on/demandware.static/-/Sites-brooks-master-catalog/default/dw5b5fcf83/original/110435/110435-072-l-revel-7-mens-fast-running-and-training-shoe.png' },
  { id: 'nike-hyperspeed', title: 'Nike Zoom Hyperspeed Court SE', store: 'Nike', category: 'Обувь', price: 75.97, referencePrice: 90, observedOn: '2026-09-13', url: 'https://www.nike.com/t/zoom-hyperspeed-court-se-volleyball-shoes-m4Fqj0', image: 'https://static.nike.com/a/images/t_default/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/d5bc8ca6-94d5-4e55-b64a-d0560d4c1d7d/NIKE+ZOOM+HYPERSPEED+COURT+SE.png' },
  { id: 'ekouaer-pajama', title: 'Ekouaer Cami & Shorts Set', store: 'Amazon', category: 'Одежда', price: 9.99, referencePrice: 27.99, observedOn: '2026-09-13', url: 'https://www.amazon.com/Ekouaer-Pajamas-Sleepwear-Lingerie-Shorts/dp/B09F3FV4P3', image: 'https://m.media-amazon.com/images/I/61OzkDt-WjL._AC_SL1500_.jpg' },
  { id: 'hanes-hoodie', title: 'Hanes EcoSmart Pullover Hoodie', store: 'Amazon', category: 'Одежда', price: 8, referencePrice: 27, observedOn: '2026-09-13', url: 'https://www.amazon.com/Hanes-Comfortblend-Ecosmart-Hooded-Pullover/dp/B014WDBLOE', image: 'https://m.media-amazon.com/images/I/71VQz7XMnEL._AC_SL1500_.jpg' },
  { id: 'silkworld-swim', title: 'SILKWORLD Swim Trunks', store: 'Amazon', category: 'Одежда', price: 9.99, referencePrice: 24.98, observedOn: '2026-09-13', url: 'https://www.amazon.com/SILKWORLD-Compression-Bathing-Swimming-Pockets/dp/B0BYSYGMM7', image: 'https://m.media-amazon.com/images/I/71rsipJ6HXL._AC_SL1500_.jpg' },
  { id: 'nyx-butter-gloss', title: 'NYX Butter Gloss · Praline', store: 'Target', category: 'Красота', price: 2.72, referencePrice: 6, observedOn: '2026-09-13', url: 'https://www.target.com/p/nyx-professional-makeup-butter-lip-gloss-16-praline-0-27-fl-oz/-/A-51033539', image: 'https://target.scene7.com/is/image/Target/GUEST_6ef071cd-f733-4777-a38d-f711b5c16fef?wid=800&hei=800&qlt=80' },
  { id: 'real-perfection-brushes', title: 'Real Perfection · 16 кистей', store: 'Amazon', category: 'Красота', price: 6.79, referencePrice: 19.99, observedOn: '2026-09-13', url: 'https://www.amazon.com/Real-Perfection-Synthetic-Foundation-Concealers/dp/B0DPJP4M9H', image: 'https://m.media-amazon.com/images/I/71v686sxRAL._SL1500_.jpg' },
  { id: 'laura-geller-balm', title: 'Laura Geller Jelly Balm', store: 'Amazon', category: 'Красота', price: 8.64, referencePrice: 24, observedOn: '2026-09-13', url: 'https://www.amazon.com/LAURA-GELLER-NEW-YORK-Moisturizing/dp/B0FHXWN4YY', image: 'https://m.media-amazon.com/images/I/51LQhptCbcL._SL1500_.jpg' },
  { id: 'elf-lip-stain', title: 'e.l.f. Glossy Lip Stain Kit', store: 'Target', category: 'Красота', price: 11.40, referencePrice: 24, observedOn: '2026-09-13', url: 'https://www.target.com/p/e-l-f-glossy-lip-stain-shades-4-days-kit-0-008oz/-/A-94611705', image: 'https://target.scene7.com/is/image/Target/GUEST_2f9afae9-7e09-49cf-940d-5b6a026cdf20?wid=800&hei=800&qlt=80' },
  { id: 'galaxy-s25-ultra', title: 'Galaxy S25 Ultra · Certified Re-Newed', store: 'Samsung', category: 'Техника', price: 1129, referencePrice: 1419.99, observedOn: '2026-09-13', url: 'https://www.samsung.com/us/smartphones/galaxy-s-series/certified-re-newed-store/buy/galaxy-s25-ultra-certified-re-newed-1tb-sku-sm5s938uzdfxaa/', image: 'https://images.samsung.com/is/image/samsung/p6pim/us/sm5s938uzdfxaa/gallery/us-galaxy-s25-s938-570119-sm5s938uzdfxaa-549840889' },
  { id: 'moto-g-power', title: 'Motorola Moto G Power 5G · 128 GB', store: 'Walmart', category: 'Техника', price: 65.02, referencePrice: 89.99, observedOn: '2026-09-13', url: 'https://www.walmart.com/ip/Tracfone-Motorola-moto-g-Power-5G-2024-128GB-Black-Prepaid-Smartphone-Locked-to-Tracfone/5405238462', image: 'https://i5.walmartimages.com/seo/Tracfone-Motorola-moto-g-Power-5G-2024-128GB-Black-Prepaid-Smartphone-Locked-to-Tracfone_20bc8490-45a4-4fe2-a4f9-24aeb5041f37.701446dcd0438058ea92f6a5478b641e.jpeg' },
  { id: 'softsoap-refill', title: 'Softsoap Antibacterial Refill · 50 oz', store: 'Amazon', category: 'Дом', price: 3.69, referencePrice: 5.97, observedOn: '2026-09-13', url: 'https://www.amazon.com/Softsoap-Antibacterial-Liquid-Hand-Refill/dp/B08R8PS5PB', image: 'https://m.media-amazon.com/images/I/71vEFag8EyL._SL1500_.jpg' },
];

export const communityDiscount = (deal: CommunityDeal) => Math.round((1 - deal.price / deal.referencePrice) * 100);

export function communityEstimatedWeight(deal: CommunityDeal) {
  if (deal.category === 'Обувь') return 2.2;
  if (deal.category === 'Одежда') return deal.id === 'hanes-hoodie' ? 1.5 : deal.id === 'silkworld-swim' ? 1.1 : 1.2;
  if (deal.category === 'Техника') return 1.5;
  if (deal.category === 'Дом') return 2.4;
  return deal.id === 'real-perfection-brushes' ? 1.1 : 1;
}

export type CommunityDealOption = { label: string; size?: string; color?: string };

export const hasSelectableDimensions = (options: CommunityDealOption[]) =>
  options.some(option => Boolean(option.size || option.color));

const sized = (values: string[]): CommunityDealOption[] => values.map(size => ({ label: size, size }));

export function communityFallbackOptions(deal: CommunityDeal): CommunityDealOption[] {
  if (deal.category === 'Обувь') return sized(['US 7', 'US 7.5', 'US 8', 'US 8.5', 'US 9', 'US 9.5', 'US 10', 'US 10.5', 'US 11', 'US 12', 'US 13']);
  if (deal.id === 'hanes-hoodie') return sized(['S', 'M', 'L', 'XL', '2XL', '3XL']);
  if (deal.id === 'ekouaer-pajama' || deal.id === 'silkworld-swim') return sized(['S', 'M', 'L', 'XL', '2XL']);
  return [{ label: 'Указанный вариант' }];
}

export function communityProductCategory(deal: CommunityDeal) {
  if (deal.category === 'Красота') return 'Красота и уход';
  if (deal.category === 'Техника') return 'Электроника';
  if (deal.category === 'Дом') return 'Дом и быт';
  return deal.category;
}

export type CommunityCatalogProduct = Product & {
  store: string;
  observedOn: string;
  referenceUsd: number;
};

export const communityCatalogProducts: CommunityCatalogProduct[] = communityDeals.map(deal => {
  const weight = communityEstimatedWeight(deal);
  return {
    id: deal.id, name: deal.title, brand: deal.store, store: deal.store,
    category: communityProductCategory(deal), country: 'США', usd: deal.price,
    sourcePrice: deal.price, sourceCurrency: 'USD', sourceShipping: 10,
    sourceShippingCurrency: 'USD', sourceShippingUsd: 10, sourceShippingEstimated: true,
    shippingKnown: false, boxedWeight: Math.round(Math.max(0.1, weight - 0.5) * 100) / 100, weight,
    weightOrigin: 'Оценка Atlas; уточняется перед оформлением', image: deal.image,
    variants: communityFallbackOptions(deal).map(option => option.label), sourceUrl: deal.url,
    sourceExpiresAt: Date.parse(`${deal.observedOn}T23:59:59Z`) + 7 * 24 * 60 * 60 * 1000,
    observedOn: deal.observedOn, referenceUsd: deal.referencePrice,
    description: 'Товар из каталога Atlas. Цена, выбранный вариант и наличие повторно проверяются в магазине перед добавлением в корзину.',
  };
});

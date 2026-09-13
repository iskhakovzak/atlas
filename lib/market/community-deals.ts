export type CommunityDealCategory = 'Одежда' | 'Обувь' | 'Красота' | 'Техника' | 'Дом';

export type CommunityDeal = {
  id: string;
  title: string;
  store: string;
  category: CommunityDealCategory;
  price: number;
  referencePrice: number;
  score: number;
  comments: number;
  url: string;
  observedOn: string;
};

// Editorial observations from public Slickdeals listings. These are discovery links,
// not Atlas catalog snapshots and are deliberately rechecked before any calculation.
export const communityDeals: CommunityDeal[] = [
  { id: 'merrell-wrapt', title: 'Merrell Wrapt Waterproof', store: 'Merrell', category: 'Обувь', price: 44.99, referencePrice: 125, score: 111, comments: 37, observedOn: '2026-09-13', url: 'https://slickdeals.net/f/19960365-merrell-men-s-wrapt-sneakers-dark-ivy-or-dusk-44-99-free-shipping-on-75' },
  { id: 'adidas-daily-4', title: 'adidas Daily 4.0', store: 'eBay', category: 'Обувь', price: 28, referencePrice: 70, score: 74, comments: 10, observedOn: '2026-09-13', url: 'https://slickdeals.net/f/19987731-adidas-men-daily-4-0-shoes-various-from-28' },
  { id: 'brooks-revel-7', title: 'Brooks Revel 7 Running Shoes', store: 'Amazon', category: 'Обувь', price: 59.99, referencePrice: 99.99, score: 85, comments: 9, observedOn: '2026-09-13', url: 'https://slickdeals.net/shoes-deals/' },
  { id: 'new-balance-204l', title: 'New Balance 204L', store: 'New Balance', category: 'Обувь', price: 44.97, referencePrice: 120, score: 14, comments: 1, observedOn: '2026-09-13', url: 'https://slickdeals.net/shoes-deals/' },
  { id: 'nike-hyperspeed', title: 'Nike Zoom Hyperspeed Court', store: 'Nike', category: 'Обувь', price: 32.27, referencePrice: 90, score: 6, comments: 0, observedOn: '2026-09-13', url: 'https://slickdeals.net/shoes-deals/' },
  { id: 'ekouaer-pajama', title: 'Ekouaer Cami & Shorts Set', store: 'Amazon', category: 'Одежда', price: 9.99, referencePrice: 27.99, score: 51, comments: 0, observedOn: '2026-09-13', url: 'https://slickdeals.net/f/19998450-2-piece-ekouaer-women-s-cami-tank-shorts-pajama-set-various-9-99-free-shipping-w-prime-or-on-35' },
  { id: 'hanes-hoodie', title: 'Hanes Pullover Hoodie', store: 'Amazon', category: 'Одежда', price: 8, referencePrice: 27, score: 49, comments: 0, observedOn: '2026-09-13', url: 'https://slickdeals.net/apparel-deals/' },
  { id: 'silkworld-swim', title: 'SILKWORLD Swim Trunks', store: 'Amazon', category: 'Одежда', price: 9.99, referencePrice: 24.98, score: 17, comments: 9, observedOn: '2026-09-13', url: 'https://slickdeals.net/apparel-deals/' },
  { id: 'nyx-butter-gloss', title: 'NYX Butter Gloss', store: 'Amazon', category: 'Красота', price: 2.72, referencePrice: 6, score: 31, comments: 6, observedOn: '2026-09-13', url: 'https://slickdeals.net/makeup-deals/' },
  { id: 'real-perfection-brushes', title: 'Real Perfection · 16 кистей', store: 'Amazon', category: 'Красота', price: 6.79, referencePrice: 19.99, score: 30, comments: 2, observedOn: '2026-09-13', url: 'https://slickdeals.net/beauty-deals/' },
  { id: 'laura-geller-balm', title: 'Laura Geller Jelly Balm', store: 'Amazon', category: 'Красота', price: 8.64, referencePrice: 24, score: 12, comments: 0, observedOn: '2026-09-13', url: 'https://slickdeals.net/beauty-deals/' },
  { id: 'elf-lip-stain', title: 'e.l.f. Glossy Lip Stain Kit', store: 'Target', category: 'Красота', price: 11.40, referencePrice: 24, score: 8, comments: 2, observedOn: '2026-09-13', url: 'https://slickdeals.net/makeup-deals/' },
  { id: 'galaxy-s25-ultra', title: 'Samsung Galaxy S25 Ultra · Renewed', store: 'eBay', category: 'Техника', price: 765.59, referencePrice: 1419.99, score: 44, comments: 36, observedOn: '2026-09-13', url: 'https://slickdeals.net/cell-phone-deals/' },
  { id: 'iphone-12-tracfone', title: 'Apple iPhone 12 · Tracfone bundle', store: 'QVC', category: 'Техника', price: 108, referencePrice: 249.99, score: 64, comments: 67, observedOn: '2026-09-13', url: 'https://slickdeals.net/cell-phone-deals/' },
  { id: 'moto-g-power', title: 'Moto G Power 5G · bundle', store: 'Walmart', category: 'Техника', price: 49.88, referencePrice: 79.88, score: 51, comments: 57, observedOn: '2026-09-13', url: 'https://slickdeals.net/cell-phone-deals/' },
  { id: 'softsoap-refill', title: 'Softsoap Refill · 50 oz', store: 'Amazon', category: 'Дом', price: 3.69, referencePrice: 5.97, score: 127, comments: 20, observedOn: '2026-09-13', url: 'https://slickdeals.net/beauty-deals/' },
];

export const communityDiscount = (deal: CommunityDeal) => Math.round((1 - deal.price / deal.referencePrice) * 100);

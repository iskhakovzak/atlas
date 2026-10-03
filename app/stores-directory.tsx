'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Search, ShoppingBag } from 'lucide-react';
import Link from '@/components/site-link';
import { featuredStoreGroups, supportedStoreRoots, type StoreFocus } from '@/lib/importer/stores';
import { PageHeading } from './market-ui';
import { useMarket } from '@/lib/market/store';

type Focus = StoreFocus | 'Универмаг';
type StoreCard = { root: string; name: string; focus: Focus; region?: string; featured: boolean };

const allRoots = [...new Set<string>(supportedStoreRoots)];
const curated = new Map<string, { name: string; focus: Focus; region: string }>();
for (const group of featuredStoreGroups) for (const store of group.stores) {
  if (!curated.has(store.root)) curated.set(store.root, { name: store.name, focus: store.focus, region: group.region });
}

function guessedFocus(root: string): Focus {
  const host = root.toLowerCase();
  if (/(nike|adidas|asics|sneaker|footwear|footlocker|finishline|jdsports|salomon|newbalance|zappos|stockx|goat|vans|reebok|puma|hoka|dsw|champs)/.test(host)) return 'Кроссовки';
  if (/(beauty|cosmetic|makeup|skin|sephora|ulta|druni|primor|perfumer|lookfantastic|notino|douglas|glossier|fenty|dior)/.test(host)) return 'Красота';
  if (/(electronics|tech|apple|anker|satechi|spigen|bestbuy|adorama|bhphoto|microcenter|newegg|mediamarkt|saturn|pccomponentes|samsung|sony|dell|lenovo|razer|logitech|gopro|nikon|xiaomi)/.test(host)) return 'Техника';
  if (/(amazon|ebay|etsy|walmart|target|costco|carrefour|elcorte|macys|bloomingdale|nordstrom|kohls|jcpenney|neiman|saks|otto|galaxus|fnac)/.test(host)) return 'Универмаг';
  if (/(zara|mango|fashion|clothing|apparel|wear|uniqlo|asos|hm\.|hollister|gap|abercrombie|arket|cos\.|lululemon|gymshark|patagonia|burberry|gucci|prada|farfetch|zalando|revolve|ssense|boohoo|bershka|pullandbear|stradivarius|massimodutti|reserved|levi|carhartt|columbia|northface)/.test(host)) return 'Одежда';
  return 'Универмаг';
}

function storeName(root: string) {
  const known = curated.get(root)?.name;
  if (known) return known;
  return root.replace(/\.(?:com|net|org|tech|eu|de|es|fr|it|nl|ca|au|jp|tr|ae|us|co\.uk)$/i, '').replaceAll('.', ' ');
}

const stores: StoreCard[] = allRoots.map(root => {
  const known = curated.get(root);
  return { root, name: storeName(root), focus: known?.focus ?? guessedFocus(root), region: known?.region, featured: Boolean(known) };
});
const focusOrder: Focus[] = ['Одежда', 'Кроссовки', 'Красота', 'Техника', 'Универмаг'];

export function StoresDirectory() {
  const { state } = useMarket();
  const locale = state.communication.language;
  const [search, setSearch] = useState('');
  const [focus, setFocus] = useState<Focus | ''>('');
  // Home-page store chips link here with ?q=<store>; read it after hydration.
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('q'); if (q) queueMicrotask(() => setSearch(q.slice(0, 80))); }, []);
  const copy = {
    ru: { overline: 'МАГАЗИНЫ ATLAS', title: 'Найдите магазин и закажите через Atlas.', description: 'Выберите магазин и откройте оригинальную витрину. Поддержка импорта зависит от страницы: если данные не загрузятся, цену и вариант можно подтвердить вручную.', search: 'Найти магазин', all: 'Все', start: 'Вставить ссылку на товар', open: 'Открыть магазин', supported: 'магазинов в списке', enhanced: 'Расширенный импорт', noResults: 'Магазин не найден. Попробуйте домен сайта.', categories: { 'Одежда': 'Одежда', 'Кроссовки': 'Кроссовки и обувь', 'Красота': 'Красота и уход', 'Техника': 'Электроника и техника', 'Универмаг': 'Универмаги и другие магазины' }, note: 'Список означает, что домен разрешён для заказа по ссылке. Он не гарантирует доступность каждой карточки, наличие товара или цену.' },
    uz: { overline: 'ATLAS DO‘KONLARI', title: 'Do‘konni tanlang va Atlas orqali buyurtma bering.', description: 'Do‘konni tanlang va asl vitrinasini oching. Import sahifaga bog‘liq: ma’lumot yuklanmasa, narx va variantni qo‘lda tasdiqlash mumkin.', search: 'Do‘konni qidirish', all: 'Barchasi', start: 'Mahsulot havolasini kiritish', open: 'Do‘konni ochish', supported: 'ta do‘kon ro‘yxatda', enhanced: 'Kengaytirilgan import', noResults: 'Do‘kon topilmadi. Sayt domeni bilan qidiring.', categories: { 'Одежда': 'Kiyim', 'Кроссовки': 'Krossovka va poyabzal', 'Красота': 'Go‘zallik va parvarish', 'Техника': 'Elektronika va texnika', 'Универмаг': 'Univermag va boshqa do‘konlar' }, note: 'Ro‘yxat ushbu domen havola orqali buyurtma uchun ruxsat etilganini bildiradi. Har bir sahifa, mavjudlik yoki narx kafolatlanmaydi.' },
    en: { overline: 'ATLAS STORES', title: 'Choose a store and order through Atlas.', description: 'Choose a store and open its original storefront. Import support varies by page; if details are unavailable, you can confirm the price and option manually.', search: 'Search stores', all: 'All', start: 'Paste a product link', open: 'Open store', supported: 'stores listed', enhanced: 'Enhanced import', noResults: 'No store found. Try searching by domain.', categories: { 'Одежда': 'Clothing', 'Кроссовки': 'Sneakers & shoes', 'Красота': 'Beauty & care', 'Техника': 'Electronics & tech', 'Универмаг': 'Department & other stores' }, note: 'A store being listed means its domain is allowed for link orders. It does not guarantee every product page, stock or price.' },
  }[locale];
  const query = search.trim().toLocaleLowerCase();
  const filtered = useMemo(() => stores.filter(store => (!focus || store.focus === focus) && (!query || `${store.name} ${store.root} ${store.focus} ${store.region ?? ''}`.toLocaleLowerCase().includes(query))), [focus, query]);
  const sections = focus ? [focus] : focusOrder;

  return <>
    <PageHeading overline={copy.overline} title={copy.title} description={copy.description}>
      <Link className="btn primary" href="/order-by-link"><ShoppingBag size={17}/>{copy.start}<ArrowRight size={17}/></Link>
    </PageHeading>
    <section className="stores-directory surface">
      <div className="stores-directory-top"><div><strong>{allRoots.length}</strong><span>{copy.supported}</span></div><p>{copy.note}</p></div>
      <label className="stores-search"><Search size={19}/><span className="sr-only">{copy.search}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search}/></label>
      <nav className="stores-categories" aria-label={copy.overline}>
        <button type="button" aria-pressed={!focus} className={!focus ? 'active' : ''} onClick={() => setFocus('')}>{copy.all}<span>{allRoots.length}</span></button>
        {focusOrder.map(category => <button type="button" key={category} aria-pressed={focus === category} className={focus === category ? 'active' : ''} onClick={() => setFocus(focus === category ? '' : category)}>{copy.categories[category]}<span>{stores.filter(store => store.focus === category).length}</span></button>)}
      </nav>
      {filtered.length ? sections.map(category => {
        const items = filtered.filter(store => store.focus === category);
        if (!items.length) return null;
        return <section className="stores-category" key={category}><header><h2>{copy.categories[category]}</h2><span>{items.length}</span></header><div className="stores-grid">{items.map(store => <article className="store-card" key={store.root}><div className="store-card-icon"><ShoppingBag size={19}/></div><div className="store-card-name"><h3>{store.name}</h3><span>{store.root}</span></div>{store.featured&&<span className="store-card-badge">{locale === 'ru' ? store.region : locale === 'uz' ? ({'Испания':'Ispaniya','Европа':'Yevropa','США':'AQSh'} as Record<string,string>)[store.region??'']??store.region : ({'Испания':'Spain','Европа':'Europe','США':'USA'} as Record<string,string>)[store.region??'']??store.region}</span>}<a href={`https://${store.root}`} target="_blank" rel="noopener noreferrer" aria-label={`${copy.open}: ${store.name}`}><ArrowUpRight size={17}/></a></article>)}</div></section>;
      }) : <div className="stores-empty">{copy.noResults}</div>}
    </section>
  </>;
}

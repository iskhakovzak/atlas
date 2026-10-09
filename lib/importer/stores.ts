// Public product pages from the most requested international stores. The list
// is deliberately explicit: it keeps server-side importing away from internal
// addresses while letting the catalogue grow without changing the fetch logic.
export const ebayStoreRoots = [
  'ebay.com','ebay.ca','ebay.co.uk','ebay.com.au','ebay.de','ebay.es','ebay.fr','ebay.it','ebay.us',
  'ebay.at','ebay.be','ebay.ch','ebay.ie','ebay.nl','ebay.pl','ebay.ph','ebay.com.hk','ebay.com.my',
  'ebay.com.sg','ebay.co.nz','ebay.co.in','ebay.com.mx','ebay.com.br','ebay.com.ar','ebay.com.tw',
] as const;

export function isEbayStoreHost(host: string) {
  return (ebayStoreRoots as readonly string[]).includes(host.toLowerCase().replace(/^www\./, ''));
}

export const supportedStoreRoots = [
  'shop.simon.com',
  'carters.com','tommy.com','ralphlauren.com','thenorthface.com',
  'allbirds.com','kyliecosmetics.com','colourpop.com','fashionnova.com','stevemadden.com','bombas.com',
  'aloyoga.com','rarebeauty.com','rhodeskin.com','glossier.com','summerfridays.com','fentybeauty.com',
  'kith.com','cncpts.com','sneakersnstuff.com','satechi.com','satechi.net','spigen.com',
  '3ina.com','abercrombie.com','adorama.com','ae.com','aboutyou.de','aboutyou.es','aboutyou.fr','aboutyou.it',
  'adidas.com','aeropostale.com','aliexpress.com','amazon.ae','amazon.ca','amazon.com','amazon.com.au','amazon.com.tr','amazon.co.jp','amazon.co.uk','amazon.de','amazon.es','amazon.fr','amazon.it','anker.com','anthropologie.com','apple.com','arenal.com','aritzia.com','arket.com','asos.com','asics.com','bestbuy.com','bershka.com','bhphotovideo.com','birkenstock.com','bloomingdales.com','boohoo.com','bose.com','brooksrunning.com','burberry.com','calvinklein.us','carhartt.com','chanel.com','columbia.com','converse.com','costco.com','cos.com','crocs.com','cultbeauty.com','dell.com','dior.com','drmartens.com','dyson.com',...ebayStoreRoots,'elcorteingles.es','etsy.com','farfetch.com','fnac.es','freepeople.com','gap.com','google.com','gopro.com','gucci.com','gymshark.com','hm.com','hoka.com','hollisterco.com','hp.com','iherb.com','ikea.com','jbl.com','lacoste.com','lenovo.com','levi.com','lg.com','logitech.com','lookfantastic.com','lululemon.com','louisvuitton.com','macys.com','mango.com','marksandspencer.com','massimodutti.com','merrell.com','mi.com','microcenter.com','microsoft.com','moncler.com','mytheresa.com','newegg.com','newbalance.com','next.co.uk','nike.com','nikon.com','nothing.tech','nordstrom.com','northface.com','on.com','oneplus.com','oysho.com','pandora.net','patagonia.com','philips.com','prada.com','pullandbear.com','puma.com','razer.com','reebok.com','reserved.com','salomon.com','samsung.com','sephora.com','sephora.es','skechers.com','sony.com','ssense.com','stradivarius.com','swarovski.com','target.com','tiffany.com','timberland.com','ugg.com','underarmour.com','uniqlo.com','urbanoutfitters.com','ulta.com','valentino.com','vans.com','victoriassecret.com','walmart.com','wayfair.com','xiaomi.com','zara.com','zarahome.com','zalando.com'
  ,'backmarket.com','bananarepublic.gap.com','beautylish.com','bimbaylola.com','bluebananabrand.com','breuninger.com',
  'carrefour.es','champssports.com','charlottetilbury.com','coolblue.nl','cortefiel.com','credobeauty.com','decathlon.de','decathlon.es','decathlon.fr','decathlon.it','dermstore.com','desigual.com','douglas.de','douglas.es','douglas.fr','douglas.it','druni.es','dsw.com',
  'elfcosmetics.com','endclothing.com','fahertybrand.com','finishline.com','footdistrict.com','footlocker.com','footlocker.es','es.victoriassecret.com','galaxus.de','gamestop.com','goat.com','goodamerican.com',
  'jcpenney.com','jcrew.com','jdsports.com','jdsports.es','kiabi.es','kikomilano.com','kohls.com','kosas.com','laredoute.fr','lefties.com','lounge.com','luisaviaroma.com',
  'maccosmetics.com','madewell.com','mediamarkt.de','mediamarkt.es','mediamarkt.it','meritbeauty.com','milkmakeup.com','monoprice.com','morphe.com','nakedcph.com','neimanmarcus.com','nordstromrack.com','notino.de','notino.es','notino.fr','notino.it','nude-project.com',
  'ohpolly.com','oldnavy.gap.com','otto.de','patrickta.com','pccomponentes.com','pdpaola.com','perfumeriasprimor.eu','primor.eu','representclo.com','revolve.com','saigucosmetics.com','saksfifthavenue.com','saturn.de','scalperscompany.com','shopbop.com','sivasdescalzo.com','slamjam.com','spacenk.com','springfield.com','stockx.com','tartecosmetics.com','tower28beauty.com','womensecret.com','yoox.com','zalando.de','zalando.es','zalando.fr','zalando.it','zappos.com'
] as const;

export type StoreRegion = 'Испания' | 'Европа' | 'США';
export type StoreFocus = 'Одежда' | 'Кроссовки' | 'Красота' | 'Техника' | 'Универмаг';

/** The owner's 33 storefronts, including the separate Zara Spain locale. */
export const linkImportStorefronts = [
  {name: 'Amazon', url: 'https://www.amazon.com'},
  {name: 'eBay', url: 'https://www.ebay.com'},
  {name: 'Walmart', url: 'https://www.walmart.com'},
  {name: 'Target', url: 'https://www.target.com'},
  {name: 'Nike', url: 'https://www.nike.com'},
  {name: 'adidas', url: 'https://www.adidas.com/us'},
  {name: 'Zara', url: 'https://www.zara.com/us'},
  {name: 'H&M', url: 'https://www2.hm.com/en_us/index.html'},
  {name: 'New Balance', url: 'https://www.newbalance.com'},
  {name: 'PUMA', url: 'https://us.puma.com/us/en'},
  {name: 'UNIQLO', url: 'https://www.uniqlo.com/us/en'},
  {name: 'Mango', url: 'https://shop.mango.com/us/en'},
  {name: 'Bershka', url: 'https://www.bershka.com/us'},
  {name: 'Zalando', url: 'https://www.zalando.de'},
  {name: 'Gap', url: 'https://www.gap.com'},
  {name: 'Converse', url: 'https://www.converse.com'},
  {name: 'Vans', url: 'https://www.vans.com/en-us'},
  {name: 'Skechers', url: 'https://www.skechers.com'},
  {name: 'Crocs', url: 'https://www.crocs.com'},
  {name: 'Columbia', url: 'https://www.columbia.com'},
  {name: 'The North Face', url: 'https://www.thenorthface.com/en-us'},
  {name: 'Under Armour', url: 'https://www.underarmour.com/en-us'},
  {name: 'Sephora', url: 'https://www.sephora.com'},
  {name: 'Ulta Beauty', url: 'https://www.ulta.com'},
  {name: 'Victoria’s Secret', url: 'https://www.victoriassecret.com/us'},
  {name: 'Best Buy', url: 'https://www.bestbuy.com'},
  {name: 'Levi’s', url: 'https://www.levi.com/US/en_US'},
  {name: 'Pull&Bear', url: 'https://www.pullandbear.com/us'},
  {name: 'Tommy Hilfiger', url: 'https://usa.tommy.com'},
  {name: 'Ralph Lauren', url: 'https://www.ralphlauren.com'},
  {name: 'Carter’s', url: 'https://www.carters.com'},
  {name: 'Zara Spain', url: 'https://www.zara.com/es'},
  {name: 'ShopSimon', url: 'https://shop.simon.com'},
] as const;

export type FeaturedStoreGroup = {
  region: StoreRegion;
  hint: string;
  stores: { root: (typeof supportedStoreRoots)[number]; name: string; focus: StoreFocus }[];
};

// A short, useful directory rather than a claim that one country is always
// cheapest. The quote still uses the exact regional product URL supplied by
// the customer and never substitutes a different storefront silently.
export const featuredStoreGroups: FeaturedStoreGroup[] = [
  { region: 'Испания', hint: 'Масс-маркет, сезонные распродажи, косметика и техника в EUR.', stores: [
    {root:'zara.com',name:'Zara',focus:'Одежда'},{root:'mango.com',name:'Mango',focus:'Одежда'},{root:'bershka.com',name:'Bershka',focus:'Одежда'},
    {root:'pullandbear.com',name:'Pull&Bear',focus:'Одежда'},{root:'massimodutti.com',name:'Massimo Dutti',focus:'Одежда'},{root:'stradivarius.com',name:'Stradivarius',focus:'Одежда'},
    {root:'footdistrict.com',name:'FOOTDISTRICT',focus:'Кроссовки'},{root:'sivasdescalzo.com',name:'SVD',focus:'Кроссовки'},{root:'jdsports.es',name:'JD Sports España',focus:'Кроссовки'},
    {root:'druni.es',name:'Druni',focus:'Красота'},{root:'perfumeriasprimor.eu',name:'Primor',focus:'Красота'},{root:'douglas.es',name:'Douglas España',focus:'Красота'},
    {root:'sephora.es',name:'Sephora España',focus:'Красота'},{root:'arenal.com',name:'Perfumerías Arenal',focus:'Красота'},{root:'es.victoriassecret.com',name:"Victoria's Secret España",focus:'Одежда'},
    {root:'pccomponentes.com',name:'PcComponentes',focus:'Техника'},{root:'mediamarkt.es',name:'MediaMarkt España',focus:'Техника'},{root:'elcorteingles.es',name:'El Corte Inglés',focus:'Универмаг'},
  ]},
  { region: 'Европа', hint: 'Сравнивайте витрины по стране: цена, НДС и распродажи могут отличаться.', stores: [
    {root:'zalando.com',name:'Zalando',focus:'Одежда'},{root:'zalando.es',name:'Zalando España',focus:'Одежда'},{root:'zalando.de',name:'Zalando Deutschland',focus:'Одежда'},{root:'asos.com',name:'ASOS',focus:'Одежда'},{root:'zara.com',name:'Zara',focus:'Одежда'},{root:'aboutyou.de',name:'ABOUT YOU',focus:'Одежда'},
    {root:'nakedcph.com',name:'NAKED Copenhagen',focus:'Кроссовки'},{root:'sneakersnstuff.com',name:'SNS',focus:'Кроссовки'},{root:'endclothing.com',name:'END.',focus:'Кроссовки'},
    {root:'primor.eu',name:'Primor',focus:'Красота'},{root:'druni.es',name:'Druni',focus:'Красота'},{root:'notino.de',name:'Notino',focus:'Красота'},{root:'cultbeauty.com',name:'Cult Beauty',focus:'Красота'},{root:'lookfantastic.com',name:'LOOKFANTASTIC',focus:'Красота'},
    {root:'mediamarkt.de',name:'MediaMarkt Deutschland',focus:'Техника'},{root:'galaxus.de',name:'Galaxus',focus:'Техника'},{root:'fnac.es',name:'Fnac España',focus:'Универмаг'},
  ]},
  { region: 'США', hint: 'Самый широкий выбор брендов, outlet-разделов и крупных сезонных скидок.', stores: [
    {root:'shop.simon.com',name:'ShopSimon',focus:'Универмаг'},
    {root:'amazon.com',name:'Amazon US',focus:'Универмаг'},{root:'nike.com',name:'Nike',focus:'Кроссовки'},{root:'adidas.com',name:'adidas',focus:'Кроссовки'},{root:'nordstrom.com',name:'Nordstrom',focus:'Одежда'},{root:'nordstromrack.com',name:'Nordstrom Rack',focus:'Одежда'},{root:'macys.com',name:"Macy's",focus:'Универмаг'},
    {root:'ebay.com',name:'eBay',focus:'Универмаг'},{root:'walmart.com',name:'Walmart',focus:'Универмаг'},{root:'target.com',name:'Target',focus:'Универмаг'},
    {root:'footlocker.com',name:'Foot Locker',focus:'Кроссовки'},{root:'dsw.com',name:'DSW',focus:'Кроссовки'},{root:'zappos.com',name:'Zappos',focus:'Кроссовки'},
    {root:'sephora.com',name:'Sephora US',focus:'Красота'},{root:'victoriassecret.com',name:"Victoria's Secret US",focus:'Одежда'},{root:'newbalance.com',name:'New Balance US',focus:'Кроссовки'},{root:'ulta.com',name:'Ulta Beauty',focus:'Красота'},{root:'dermstore.com',name:'Dermstore',focus:'Красота'},{root:'maccosmetics.com',name:'MAC Cosmetics',focus:'Красота'},{root:'elfcosmetics.com',name:'e.l.f. Cosmetics',focus:'Красота'},{root:'morphe.com',name:'Morphe',focus:'Красота'},{root:'charlottetilbury.com',name:'Charlotte Tilbury US',focus:'Красота'},
    {root:'bestbuy.com',name:'Best Buy',focus:'Техника'},{root:'bhphotovideo.com',name:'B&H Photo',focus:'Техника'},{root:'adorama.com',name:'Adorama',focus:'Техника'},{root:'apple.com',name:'Apple US',focus:'Техника'},
  ]},
];

const shopSubdomains = new Set(['mango.com','hm.com','uniqlo.com','nike.com','adidas.com','on.com']);
// Zalando's German storefront sends English-language requests to this exact
// same-country host, and H&M serves every US product page from www2. Keep the
// exceptions explicit instead of allowing arbitrary merchant subdomains through
// the SSRF boundary.
const localizedHosts = new Set(['en.zalando.de', 'usa.tommy.com', 'us.puma.com', 'www2.hm.com']);
// Public product documents some storefronts load from a separate API host (no credentials, exact product id).
const storeApiHosts = new Set(['api.victoriassecret.com', 'redsky.target.com']);

// Precompute the explicit allowlist for constant-time URL validation.
const allowedHostsCache = new Set<string>([...localizedHosts, ...storeApiHosts]);
for (const root of supportedStoreRoots) {
  allowedHostsCache.add(root);
  if (root !== 'shop.simon.com') allowedHostsCache.add('www.' + root);
  if (shopSubdomains.has(root)) allowedHostsCache.add('shop.' + root);
}

/** Exact hostnames accepted by the source fetcher; shared with the isolated egress proxy. */
export const supportedStoreHosts = [...allowedHostsCache].sort();

export function isSupportedStoreHost(host:string){
  return allowedHostsCache.has(host.toLowerCase());
}

export const supportedStoreCount=supportedStoreRoots.length;

/**
 * Stores whose product pages Atlas cannot read at all (403 to every route, the desktop Chrome included; checked
 * 10 October 2026): Atlas does not try them. The customer fills in the name, price, option and store delivery from
 * the store page and confirms them; the server accepts that confirmed snapshot without a store check, and the
 * operator compares it with the store before buying. Removing a root here turns automatic import back on.
 */
export const manualEntryStoreRoots = [
  'columbia.com','bestbuy.com',
] as const;
const manualEntryHosts = new Set<string>();
for (const root of manualEntryStoreRoots) {
  manualEntryHosts.add(root);
  manualEntryHosts.add('www.' + root);
  if (shopSubdomains.has(root)) manualEntryHosts.add('shop.' + root);
}

/**
 * Stores that refuse every server client but open in an ordinary desktop browser: only the Tashkent gateway's own
 * Chrome reads them (deploy/upcloud/browser-engine.mjs, checked 10 October 2026). The gateway gets a longer turn for
 * them, and when it cannot answer (the computer is off) the customer enters the details by hand and confirms them,
 * as for manualEntryStoreRoots; a confirmed line is still checked live when the store answers.
 * Walmart is here too (checked 10 October 2026, ~3.5 s); Bright Data stays its paid fallback (lib/importer/fetch.ts).
 */
export const browserStoreRoots = [
  'sephora.com','hm.com','macys.com','levi.com','newbalance.com','victoriassecret.com','walmart.com',
] as const;
const browserHosts = new Set<string>(['www2.hm.com','api.victoriassecret.com']);
for (const root of browserStoreRoots) {
  browserHosts.add(root);
  browserHosts.add('www.' + root);
}

export function isBrowserStoreHost(host:string){
  return browserHosts.has(host.toLowerCase().replace(/\.$/, ''));
}

export function isManualEntryStoreHost(host:string){
  return manualEntryHosts.has(host.toLowerCase().replace(/\.$/, ''));
}

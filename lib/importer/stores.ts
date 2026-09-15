// Public product pages from the most requested international stores. The list
// is deliberately explicit: it keeps server-side importing away from internal
// addresses while letting the catalogue grow without changing the fetch logic.
export const supportedStoreRoots = [
  'allbirds.com','kyliecosmetics.com','colourpop.com','fashionnova.com','stevemadden.com','bombas.com',
  'aloyoga.com','rarebeauty.com','rhodeskin.com','glossier.com','summerfridays.com','fentybeauty.com',
  'kith.com','cncpts.com','sneakersnstuff.com','satechi.com','satechi.net','spigen.com',
  '3ina.com','abercrombie.com','adorama.com','ae.com','aboutyou.de','aboutyou.es','aboutyou.fr','aboutyou.it',
  'adidas.com','aeropostale.com','aliexpress.com','amazon.ae','amazon.ca','amazon.com','amazon.com.au','amazon.com.tr','amazon.co.jp','amazon.co.uk','amazon.de','amazon.es','amazon.fr','amazon.it','anker.com','anthropologie.com','apple.com','aritzia.com','arket.com','asos.com','asics.com','bestbuy.com','bershka.com','bhphotovideo.com','birkenstock.com','bloomingdales.com','boohoo.com','bose.com','brooksrunning.com','burberry.com','calvinklein.us','carhartt.com','chanel.com','columbia.com','converse.com','costco.com','cos.com','crocs.com','cultbeauty.com','dell.com','dior.com','drmartens.com','dyson.com','ebay.ca','ebay.co.uk','ebay.com','ebay.com.au','ebay.de','ebay.es','ebay.fr','ebay.it','elcorteingles.es','etsy.com','farfetch.com','fnac.es','freepeople.com','gap.com','google.com','gopro.com','gucci.com','gymshark.com','hm.com','hoka.com','hollisterco.com','hp.com','iherb.com','ikea.com','jbl.com','lacoste.com','lenovo.com','levi.com','lg.com','logitech.com','lookfantastic.com','lululemon.com','louisvuitton.com','macys.com','mango.com','marksandspencer.com','massimodutti.com','merrell.com','mi.com','microcenter.com','microsoft.com','moncler.com','mytheresa.com','newegg.com','newbalance.com','next.co.uk','nike.com','nikon.com','nothing.tech','nordstrom.com','northface.com','on.com','oneplus.com','oysho.com','pandora.net','patagonia.com','philips.com','prada.com','pullandbear.com','puma.com','razer.com','reebok.com','reserved.com','salomon.com','samsung.com','sephora.com','skechers.com','sony.com','ssense.com','stradivarius.com','swarovski.com','target.com','tiffany.com','timberland.com','ugg.com','underarmour.com','uniqlo.com','urbanoutfitters.com','ulta.com','valentino.com','vans.com','walmart.com','wayfair.com','xiaomi.com','zara.com','zarahome.com','zalando.com'
  ,'backmarket.com','bananarepublic.gap.com','beautylish.com','bimbaylola.com','bluebananabrand.com','breuninger.com',
  'carrefour.es','champssports.com','coolblue.nl','cortefiel.com','credobeauty.com','decathlon.de','decathlon.es','decathlon.fr','decathlon.it','dermstore.com','desigual.com','douglas.de','douglas.es','douglas.fr','douglas.it','druni.es','dsw.com',
  'endclothing.com','fahertybrand.com','finishline.com','footdistrict.com','footlocker.com','footlocker.es','galaxus.de','gamestop.com','goat.com','goodamerican.com',
  'jcpenney.com','jcrew.com','jdsports.com','jdsports.es','kiabi.es','kikomilano.com','kohls.com','kosas.com','laredoute.fr','lefties.com','lounge.com','luisaviaroma.com',
  'madewell.com','mediamarkt.de','mediamarkt.es','mediamarkt.it','meritbeauty.com','milkmakeup.com','monoprice.com','nakedcph.com','neimanmarcus.com','nordstromrack.com','notino.de','notino.es','notino.fr','notino.it','nude-project.com',
  'ohpolly.com','oldnavy.gap.com','otto.de','patrickta.com','pccomponentes.com','pdpaola.com','perfumeriasprimor.eu','representclo.com','revolve.com','saigucosmetics.com','saksfifthavenue.com','saturn.de','scalperscompany.com','shopbop.com','sivasdescalzo.com','slamjam.com','spacenk.com','springfield.com','stockx.com','tartecosmetics.com','tower28beauty.com','womensecret.com','yoox.com','zalando.de','zalando.es','zalando.fr','zalando.it','zappos.com'
] as const;

export type StoreRegion = 'Испания' | 'Европа' | 'США';
export type StoreFocus = 'Одежда' | 'Кроссовки' | 'Красота' | 'Техника' | 'Универмаг';

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
    {root:'pccomponentes.com',name:'PcComponentes',focus:'Техника'},{root:'mediamarkt.es',name:'MediaMarkt España',focus:'Техника'},{root:'elcorteingles.es',name:'El Corte Inglés',focus:'Универмаг'},
  ]},
  { region: 'Европа', hint: 'Сравнивайте витрины по стране: цена, НДС и распродажи могут отличаться.', stores: [
    {root:'zalando.es',name:'Zalando España',focus:'Одежда'},{root:'zalando.de',name:'Zalando Deutschland',focus:'Одежда'},{root:'aboutyou.de',name:'ABOUT YOU',focus:'Одежда'},
    {root:'nakedcph.com',name:'NAKED Copenhagen',focus:'Кроссовки'},{root:'sneakersnstuff.com',name:'SNS',focus:'Кроссовки'},{root:'endclothing.com',name:'END.',focus:'Кроссовки'},
    {root:'notino.de',name:'Notino',focus:'Красота'},{root:'cultbeauty.com',name:'Cult Beauty',focus:'Красота'},{root:'lookfantastic.com',name:'LOOKFANTASTIC',focus:'Красота'},
    {root:'mediamarkt.de',name:'MediaMarkt Deutschland',focus:'Техника'},{root:'galaxus.de',name:'Galaxus',focus:'Техника'},{root:'fnac.es',name:'Fnac España',focus:'Универмаг'},
  ]},
  { region: 'США', hint: 'Самый широкий выбор брендов, outlet-разделов и крупных сезонных скидок.', stores: [
    {root:'nordstrom.com',name:'Nordstrom',focus:'Одежда'},{root:'nordstromrack.com',name:'Nordstrom Rack',focus:'Одежда'},{root:'macys.com',name:"Macy's",focus:'Универмаг'},
    {root:'footlocker.com',name:'Foot Locker',focus:'Кроссовки'},{root:'dsw.com',name:'DSW',focus:'Кроссовки'},{root:'zappos.com',name:'Zappos',focus:'Кроссовки'},
    {root:'sephora.com',name:'Sephora',focus:'Красота'},{root:'ulta.com',name:'Ulta Beauty',focus:'Красота'},{root:'dermstore.com',name:'Dermstore',focus:'Красота'},
    {root:'bestbuy.com',name:'Best Buy',focus:'Техника'},{root:'bhphotovideo.com',name:'B&H Photo',focus:'Техника'},{root:'adorama.com',name:'Adorama',focus:'Техника'},
  ]},
];

const shopSubdomains = new Set(['mango.com','hm.com','uniqlo.com','nike.com','adidas.com','on.com']);

export function isSupportedStoreHost(host:string){
  const normalized=host.toLowerCase();
  return supportedStoreRoots.some(root=>normalized===root||normalized==='www.'+root||(shopSubdomains.has(root)&&normalized==='shop.'+root));
}

export const supportedStoreCount=supportedStoreRoots.length;

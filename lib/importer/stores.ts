// Public product pages from the most requested international stores. The list
// is deliberately explicit: it keeps server-side importing away from internal
// addresses while letting the catalogue grow without changing the fetch logic.
export const supportedStoreRoots = [
  'adidas.com','aeropostale.com','aliexpress.com','amazon.ae','amazon.ca','amazon.com','amazon.com.au','amazon.com.tr','amazon.co.jp','amazon.co.uk','amazon.de','amazon.es','amazon.fr','amazon.it','anker.com','anthropologie.com','apple.com','aritzia.com','arket.com','asos.com','asics.com','bestbuy.com','bershka.com','bhphotovideo.com','birkenstock.com','bloomingdales.com','boohoo.com','bose.com','brooksrunning.com','burberry.com','calvinklein.us','carhartt.com','chanel.com','columbia.com','converse.com','costco.com','cos.com','crocs.com','cultbeauty.com','dell.com','dior.com','drmartens.com','dyson.com','ebay.ca','ebay.co.uk','ebay.com','ebay.com.au','ebay.de','ebay.es','ebay.fr','ebay.it','elcorteingles.es','etsy.com','farfetch.com','fnac.es','freepeople.com','gap.com','google.com','gopro.com','gucci.com','gymshark.com','hm.com','hoka.com','hollisterco.com','hp.com','iherb.com','ikea.com','jbl.com','lacoste.com','lenovo.com','levi.com','lg.com','logitech.com','lookfantastic.com','lululemon.com','louisvuitton.com','macys.com','mango.com','marksandspencer.com','massimodutti.com','mi.com','microcenter.com','microsoft.com','moncler.com','mytheresa.com','newegg.com','newbalance.com','next.co.uk','nike.com','nikon.com','nothing.tech','nordstrom.com','northface.com','on.com','oneplus.com','oysho.com','pandora.net','patagonia.com','philips.com','prada.com','pullandbear.com','puma.com','razer.com','reebok.com','reserved.com','salomon.com','samsung.com','sephora.com','skechers.com','sony.com','ssense.com','stradivarius.com','swarovski.com','target.com','tiffany.com','timberland.com','ugg.com','underarmour.com','uniqlo.com','urbanoutfitters.com','ulta.com','valentino.com','vans.com','walmart.com','wayfair.com','xiaomi.com','zara.com','zarahome.com','zalando.com'
] as const;

const shopSubdomains = new Set(['mango.com','hm.com','uniqlo.com','nike.com','adidas.com','on.com']);

export function isSupportedStoreHost(host:string){
  const normalized=host.toLowerCase();
  return supportedStoreRoots.some(root=>normalized===root||normalized==='www.'+root||(shopSubdomains.has(root)&&normalized==='shop.'+root));
}

export const supportedStoreCount=supportedStoreRoots.length;

import Marketplace from '../marketplace';
import { CartView } from '../shopping';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../styles/catalog-pages.css';
import '../styles/stores-pages.css';
import '../styles/link-pages.css';
import '../styles/member-pages.css';
import '../styles/catalog-cards.css';
// Cart selection and the checkout review; not needed by other pages.
import '../cart-select.css';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('cart', await pageLocale()); }
export default function Page(){return <Marketplace view="cart"><CartView/></Marketplace>;}

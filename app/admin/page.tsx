import Marketplace from '../marketplace';
import { AdminView } from '../admin-view';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../styles/operator.css';
import '../styles/catalog-pages.css';
import '../styles/stores-pages.css';
import '../styles/link-pages.css';
import '../styles/member-pages.css';
import '../styles/catalog-cards.css';
// Operator-only styles load with this route, not on every customer page.
// Admin-only layers that used to load on every page (same relative order as in app/layout.tsx).
import '../catalog-admin.css';
import '../catalog-import.css';
import '../admin-promo.css';
import '../admin-wide.css';
import '../accounting.css';
import '../admin-investor.css';
import '../site-content-admin.css';
import '../operator-mobile.css';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('admin', await pageLocale()); }
export default function Page(){return <Marketplace view="admin"><AdminView/></Marketplace>;}

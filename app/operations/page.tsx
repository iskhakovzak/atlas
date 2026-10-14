import Marketplace from '../marketplace';
import { OrdersView } from '../order-workspace';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../styles/catalog-pages.css';
import '../styles/stores-pages.css';
import '../styles/link-pages.css';
import '../styles/member-pages.css';
import '../styles/catalog-cards.css';
// Operator phone layout (every rule is scoped to .operator-admin or main[data-view="operations"]): loads with the
// operator routes only, not on customer pages.
// Page-only layers, in their former app/layout.tsx order.
import '../orders-groups.css';
import '../admin-wide.css';
import '../operator-mobile.css';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('operations', await pageLocale()); }
export default function Page(){return <Marketplace view="operations"><OrdersView operations/></Marketplace>;}

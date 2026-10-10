import Marketplace from '../marketplace';
import { OrdersView } from '../order-workspace';
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

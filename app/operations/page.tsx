import Marketplace from '../marketplace';
import { OrdersView } from '../order-workspace';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('operations', await pageLocale()); }
export default function Page(){return <Marketplace view="operations"><OrdersView operations/></Marketplace>;}

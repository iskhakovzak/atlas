import Marketplace from '../marketplace';
import { OrdersView } from '../order-workspace';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('orders', await pageLocale()); }
export default function Page(){return <Marketplace view="orders"><OrdersView operations={false}/></Marketplace>;}

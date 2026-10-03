import Marketplace from '../marketplace';
import { BalanceView } from '../order-workspace';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('balance', await pageLocale()); }
export default function Page(){return <Marketplace view="balance"><BalanceView/></Marketplace>;}

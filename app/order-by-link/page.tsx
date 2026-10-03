import Marketplace from '../marketplace';
import { GlobalLinkOrder } from '../global-link-order';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('link', await pageLocale()); }
export default function Page(){return <Marketplace view="link"><GlobalLinkOrder/></Marketplace>;}

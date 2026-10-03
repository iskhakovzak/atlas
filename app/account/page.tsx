import Marketplace from '../marketplace';
import { AccountView } from '../account-views';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('account', await pageLocale()); }
export const dynamic='force-dynamic';
export default function Page(){return <Marketplace view="account"><AccountView/></Marketplace>;}

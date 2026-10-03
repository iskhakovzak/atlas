import Marketplace from '../marketplace';
import { AdminView } from '../admin-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('admin', await pageLocale()); }
export default function Page(){return <Marketplace view="admin"><AdminView/></Marketplace>;}

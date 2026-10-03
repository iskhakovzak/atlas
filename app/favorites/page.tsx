import Marketplace from '../marketplace';
import { HomeCatalog } from '../home-catalog';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('favorites', await pageLocale()); }
export default function Page(){return <Marketplace view="favorites"><HomeCatalog favorites/></Marketplace>;}

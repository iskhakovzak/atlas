import Marketplace from '../marketplace';
import { IdentityView } from '../identity-workspace';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('identity', await pageLocale()); }
export default function Page(){return <Marketplace view="identity"><IdentityView/></Marketplace>;}

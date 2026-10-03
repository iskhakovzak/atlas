import Marketplace from '../marketplace';
import { LoginView } from '../login-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('login', await pageLocale()); }
export const dynamic='force-dynamic';
export default function Page(){return <Marketplace view="login"><LoginView/></Marketplace>;}

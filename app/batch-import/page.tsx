import Marketplace from '../marketplace';
import { BatchImportView } from '../batch-import';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('batch', await pageLocale()); }
export default function Page(){return <Marketplace view="batch"><BatchImportView/></Marketplace>;}

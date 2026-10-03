import Marketplace from "../marketplace";
import { AnalyticsView } from '../prelaunch-views';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('analytics', await pageLocale()); }
export default function Page() { return <Marketplace view="analytics"><AnalyticsView/></Marketplace>; }

import Marketplace from "../marketplace";
import { NotificationsView } from '../order-workspace';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('notifications', await pageLocale()); }

export default function Page() {
  return <Marketplace view="notifications"><NotificationsView/></Marketplace>;
}

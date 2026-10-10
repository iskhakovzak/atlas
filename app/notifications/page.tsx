import Marketplace from "../marketplace";
import { NotificationsView } from '../order-workspace';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
// Order cards (app/order-workspace.tsx); not needed by other pages.
import '../orders-groups.css';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('notifications', await pageLocale()); }

export default function Page() {
  return <Marketplace view="notifications"><NotificationsView/></Marketplace>;
}

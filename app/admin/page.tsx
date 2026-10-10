import Marketplace from '../marketplace';
import { AdminView } from '../admin-view';
// Operator-only styles load with this route, not on every customer page.
// Admin-only layers that used to load on every page (same relative order as in app/layout.tsx).
import '../catalog-admin.css';
import '../catalog-import.css';
import '../admin-wide.css';
import '../accounting.css';
import '../admin-investor.css';
import '../site-content-admin.css';
import '../operator-mobile.css';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('admin', await pageLocale()); }
export default function Page(){return <Marketplace view="admin"><AdminView/></Marketplace>;}

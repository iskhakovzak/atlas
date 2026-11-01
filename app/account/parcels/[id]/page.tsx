import Marketplace from '../../../marketplace';
import { ParcelView } from '../../../parcel-view';
import type { Metadata } from 'next';
import { pageLocale } from '../../../page-locale';
import { privateMetadata } from '../../../route-metadata';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../../../styles/link-pages.css';
import '../../../styles/member-pages.css';
import '../../../styles/catalog-cards.css';
// The parcel-first profile (app/profile.css): hub, parcel page, documents and settings.
import '../../../profile.css';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('parcel', await pageLocale()); }
export const dynamic = 'force-dynamic';
/** A parcel of the signed-in buyer, opened by any of its order numbers (lib/market/parcels.ts parcelOf). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Marketplace view="parcel"><ParcelView id={decodeURIComponent(id)} /></Marketplace>;
}

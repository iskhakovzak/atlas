import Marketplace from '../marketplace';
import { DeclarationView } from '../identity-workspace';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../styles/link-pages.css';
import '../styles/member-pages.css';
import '../styles/catalog-cards.css';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('declaration', await pageLocale()); }
export default function Page(){return <Marketplace view="declaration"><DeclarationView/></Marketplace>;}

import Marketplace from '../marketplace';
import { CartView } from '../shopping';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
// Cart selection and the checkout review; not needed by other pages.
import '../cart-select.css';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('cart', await pageLocale()); }
export default function Page(){return <Marketplace view="cart"><CartView/></Marketplace>;}

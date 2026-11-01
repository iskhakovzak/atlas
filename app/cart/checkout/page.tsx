import Marketplace from '../../marketplace';
import { CheckoutView } from '../../checkout-view';
import type { Metadata } from 'next';
import { pageLocale } from '../../page-locale';
import { privateMetadata } from '../../route-metadata';
// Shared route rules (see app/cart/page.tsx), then the checkout's own layer (redesign stage 6).
import '../../styles/link-pages.css';
import '../../styles/member-pages.css';
import '../../cart-select.css';
import '../../checkout.css';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('checkout', await pageLocale()); }
// One page for guests and customers: sign-in happens inside it (app/checkout-view.tsx).
export default function Page(){return <Marketplace view="checkout"><CheckoutView/></Marketplace>;}

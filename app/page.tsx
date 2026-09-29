import Marketplace from './marketplace';
import { catalogRouteMetadata } from './route-metadata';
export const metadata = catalogRouteMetadata;
export default function Page(){return <Marketplace view="catalog"/>}

import Marketplace from "../marketplace";
import { privateRouteMetadata } from "../route-metadata";
export const dynamic = "force-dynamic";
export const metadata = privateRouteMetadata;
export default function Page() { return <Marketplace view="analytics" />; }

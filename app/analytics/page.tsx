import Marketplace from "../marketplace";
import { privateRouteMetadata } from "../route-metadata";
export const metadata = privateRouteMetadata;
export const dynamic = "force-dynamic";
export default function Page() { return <Marketplace view="analytics" />; }

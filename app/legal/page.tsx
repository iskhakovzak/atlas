import Marketplace from "../marketplace";
import { legalRouteMetadata } from "../route-metadata";
export const dynamic = "force-dynamic";
export const metadata = legalRouteMetadata;
export default function Page() { return <Marketplace view="legal" />; }

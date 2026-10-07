import { jsonLd } from '@/lib/seo/structured-data';

/** schema.org data for search engines; renders in the server HTML of server and client components alike. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />;
}

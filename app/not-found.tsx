import Marketplace from './marketplace';
import { NotFoundView } from './not-found-view';

// Unknown addresses keep the header, footer and language of the site, with ways back to the main actions.
export default function NotFound() {
  return <Marketplace view="notfound"><NotFoundView /></Marketplace>;
}

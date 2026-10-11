# Mobile UX audit — 11 October 2026

Source: Sites 166 (PRs 63/64), with documentation from GitHub main a4082539. Continued on 12 October. The owner initially deferred PR creation, then explicitly authorized PR creation, merge and deployment on 12 October. This report describes the release candidate; deployment is confirmed separately by the Sites receipt.

## Approved changes

12 October product decision: delivery speed is selected only in the cart. Removed the independent express/standard previews from link import and the catalog sheet. Estimates follow the cart's speed (express for a guest); adding a product and resuming an older pending add cannot issue a delivery-speed change. Optional legacy draft fields remain readable. Removed the inner square focus frame/shadow from composite URL inputs; their outer container retains visible focus. Evidence: `link-focus-clean-320.jpg`.

Local browser regression: selected Standard in the existing synthetic Nike cart, imported the green hoodie, selected M and added one unit. The cart then showed three units and Standard still selected. The link-import estimate had no speed switch, with a short note directing the choice to the cart. The catalog sheet's Cost calculation tab likewise had no speed selector. These changes affected only local test D1, with no production cart/order writes in this follow-up. Focused URL input computed outline-style:none, box-shadow:none and a transparent background, with the form's outer focus retained.

| Area | Observation | Change |
| --- | --- | --- |
| Product sheet | A 12-photo gallery pushed the title to about y=698 on a 390×844 viewport. | Bound the mobile stage height to 32dvh (160–280px), reduce gallery spacing and keep 44×44 thumbnail buttons. The multi-photo title starts around y=574; the single-photo title around y=452. Photos retain object-fit:contain. |
| Catalog | Collections occupied space above search and products. | A mobile disclosure keeps collections available and collapses after a selection. Desktop collections remain visible. |
| Stores | Search started around document y=1245. | Move the single search field below the heading/intro (around y=240 at 390px). A filtered-result count links to the directory. URL import, regions and other store blocks remain available. |
| Home | The sticky link button used a 68px dock above the 61px navigation. | Use a 44px button in a 56px dock and update chapter/scroll clearance from the same variable. |

## Additional fixes

- Catalog search with a clear button expanded the 320px page to 355px. Give the toolbar a minmax(0,1fr) track and allow the search flex item to shrink.
- Search accessible names included the clear button text. Explicit localized input names remain stable as the query changes.
- On 320×568, the product sheet's sticky total was constrained by the description container; the continuation button extended below the viewport. Move the total to the sheet itself, preserving desktop gutters. The button now ends at y=556 inside a 568px viewport.
- Long privacy links could overflow narrow footer columns; allow wrapping and constrain link width. Also allow the consent notice text to shrink/wrap without changing its consent behavior.
- Cart cards separate colours and group sizes of one colour using merchant metadata. eBay sizes can share a card across different variation/referral URLs. Unknown composite options stay separate; no colour is guessed from punctuation. Structured colour is shown once in the header, while rows retain size/width/other options, quantity, amount, selection and removal.
- Quantity control accessible names include the full selected variant. Review actions “Leave for later” and “Change” have 44px mobile hit areas.
- A validation error from an empty option selection now clears on form edits and option/quantity changes; submit still performs all validation. Browser regression: missing-size alert appeared, then disappeared immediately after selecting Nike M.
- Approved follow-up: mobile document/consent notice becomes a compact summary with an explicit Details/Collapse button. Full text and all document links remain available; acceptance action, version, persistence and account scoping are unchanged. At 390px the collapsed notice measures about 87px. Expanding/collapsing does not accept consent.
- The 320px checkout review exposed a clipped confirmation label and an overflowing step heading. Narrow review containers now put the amount above a full-width confirmation button; at 320px the current-step label sits below the step circles. Shared colour appears once in grouped review rows, while size and other options remain on their own lines.

## Coverage and limits

Chrome on Windows, responsive viewports: 320×568, 360×800, 390×844, 430×932, and 844×390 landscape. These are browser layout checks, not physical-device certification or a full cross-product of every route, theme and size.

Initial live read-only checks covered home, catalog, filter drawer, empty search, 12-photo product sheet, stores/search, an existing cart, orders, account, batch-import entry, support, customs and app information. Russian and Uzbek text and light/dark states were observed.

At the owner's request, the subsequent authenticated live pass added Nike green M, green L and red L (one each), retained the pre-existing eBay shoe, tested quantity up/down with server repricing, partial and empty checkout selection, confirmation-before-removal, per-line note expansion, parcel-service expansion, saved-recipient review and required-field validation for a new recipient. All items were selected again. The owner asked to retain the three test variants. No production order, payment, recipient/address edit, service change, support message or catalog publication was submitted. Different colour photos and prices were verified ($44.97 green / $50.97 red at observation time); these are observations, not current-price or stock guarantees.

An isolated local development account subsequently imported two Nike sizes, added them through the real authenticated API, verified compact rows and per-variant accessible controls, rejected a three-digit postal code, created a test preorder with invented recipient/address, and completed the explicitly simulated payment. The two line amounts and one batch payment matched the review; the batch moved from “Action needed” to “In progress”, generated a notification and left the cart empty. These writes exist only in the worktree's local D1; no money was charged and no merchant purchase/shipment was initiated.

Following the local checkout revealed another bug: the order hash continuously reselected its tab, preventing a manual tab/search change. Explicit tab/search edits now clear the linked-order hash with history.replaceState while preserving history state; initial links still reveal their order. Mobile alert-dialog buttons were 36px tall and are now at least 44px. At 320px the final review has equal client/scroll width (255px), separate size rows, and a fully visible confirmation button.

Local production Worker checks cover approved changes, keyboard disclosure/selection, stable search names, unavailable-search state, unsupported-link recovery, guest login guards and gallery controls. The local D1 contains migrations and a UI fixture derived from the public catalog; its stock flags are fixture values for rendering, not evidence of current merchant stock. No production D1 or secrets were copied.

The Sites owner toolbar can overlap the bottom-right cabinet link. This is editor UI, so the application does not hide or restyle it. Owner testing should hide the toolbar and check guest UI separately.

Still required: physical iOS Safari/Android testing (browser chrome, real keyboard, safe areas, pinch/text scaling, touch swipes), and a measured accessibility/contrast pass. Small header/breadcrumb links were noted but not broadly redesigned. The owner approved the compact consent layout on 12 October; its legal text and acceptance remain intact.

## Validation

Follow-up, 12 October: added explicit localized Paste controls to home and instructional link forms, regular link import, stores directory and store dialog, customer batch import and the admin catalog queue. Single links may be extracted from shared text; batch paste appends existing lines. Clipboard is read only on a tap; insertion never submits, imports or publishes. Empty/failed reads retain manual input with guidance. Pending reads cannot overwrite edited/disconnected/disabled fields or steal focus from another control. Admin UI remains unverified separately; the shared control was exercised in customer forms.

At 320×568, document notice and duplicate floating home action stop covering active link forms; they return when focus leaves, without accepting consent. Paste targets measure 44px; the home Calculate target is 52px. Root client/scroll widths both measure 305px (15px desktop scrollbar), and desktop form client/scroll widths both measure 582px. Light and dark states were checked. Customer batch paste retained the original eBay line and appended two new links without starting the batch. Empty clipboard focused the original field. Native permission refusal and iOS paste confirmation remain physical-device checks.

SiteLink adds prefetch on mouse hover and keyboard focus to its existing press-down behavior. Browser network evidence: focusing Support requested `/support`, its component JS and route CSS before click; click then opened Support. Hover skips saveData/2G; external/API/download/new-tab links retain normal behavior. No wall-clock improvement or new mobile PageSpeed score is claimed. Reduced-motion scroll is honored; button press scale/rebound is smaller and shorter. Screenshot `paste-home-320-final.jpg` shows the local focused form without overlays, and `paste-home-dark-320.jpg` its dark state.

- Full suite: 932/932 tests pass, including five colour-grouping/option regression cases.
- Lint: no errors; one existing no-img-element warning in global-link-order.tsx.
- Production build: vinext build succeeds. Final browser evidence and raw observations are local under outputs/mobile-audit-20261011 in the original workspace; runtime files and customer screenshots are not committed.
- This work improves space and control accessibility; it does not claim a measured LCP improvement or split the shared CSS bundle.

Final local screenshots: `checkout-review-local-320-final.jpg` shows the readable step label and full confirmation button at 320×568; `home-compact-notice-final.jpg` shows the collapsed document notice; `cart-colour-sizes-local-final.jpg` shows independent M/L rows. These contain local test data, not a submitted production order.

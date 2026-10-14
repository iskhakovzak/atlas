import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { duplicateTocIds, offerToc, privacyToc, refundsToc } from "../lib/market/legal-toc.ts";

const documents = readFileSync(new URL("../app/legal-documents.tsx", import.meta.url), "utf8");

// The block of one document: from its <details id> to the next </details>.
function documentBlock(id) {
  const start = documents.indexOf(`id="${id}"`);
  assert.ok(start > 0, `document #${id} exists`);
  return documents.slice(start, documents.indexOf("</details>", start));
}

test("legal contents: ids are unique across /terms (offer, payment and refunds) and /privacy", () => {
  assert.deepEqual(duplicateTocIds(offerToc, refundsToc, privacyToc), []);
  assert.deepEqual(duplicateTocIds([{ id: "a", title: "A" }, { id: "a", title: "B" }]), ["a"]);
});

test("legal contents: every entry points at a section of its document, labelled like its heading", () => {
  for (const [docId, toc] of [["offer", offerToc], ["refunds", refundsToc], ["privacy", privacyToc]]) {
    const block = documentBlock(docId);
    for (const { id, title } of toc) {
      const at = block.search(new RegExp(`<section[^>]*\\bid="${id}"`));
      assert.ok(at >= 0, `#${id} is a section of #${docId}`);
      const heading = block.slice(at).match(/<h3>([^<]*)<\/h3>/);
      assert.equal(heading?.[1], title, `#${id} label matches its <h3>`);
    }
  }
});

test("legal contents: the contents follow the document order and cover every section with an id", () => {
  for (const [docId, toc] of [["offer", offerToc], ["refunds", refundsToc], ["privacy", privacyToc]]) {
    const ids = [...documentBlock(docId).matchAll(/<section[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(toc.map(entry => entry.id), ids);
  }
});

test("legal contents: /terms heads both of its documents in the contents, the offer and the payment and refund policy", () => {
  const pages = readFileSync(new URL("../app/legal-pages.tsx", import.meta.url), "utf8");
  const terms = pages.slice(pages.indexOf("export function TermsPage"));
  assert.ok(terms.includes('doc:{id:"offer",label:copy[locale].offer},entries:offerToc'), "the offer part of the contents");
  assert.ok(terms.includes('doc:{id:"refunds",label:copy[locale].refunds},entries:refundsToc'), "the payment and refunds part");
  assert.ok(terms.includes("<RefundsDocument open"), "the payment and refund policy is on /terms");
});

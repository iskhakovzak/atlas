"use client";

import Link from "@/components/site-link";
import { ArrowLeft } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { profileCopy } from "@/lib/market/profile-copy";
import { DeclarationView, IdentityView } from "./identity-workspace";

/**
 * /account/documents (1 November 2026): the recipients' passports and the customs declarations on one page — the old
 * /identity and /declaration redirect here (middleware.ts), each to its section (#passports, #declarations).
 */
export function DocumentsView() {
  const { state } = useMarket();
  const t = profileCopy[state.communication.language];
  return <div className="pf-page pf-documents">
    <header className="pf-page-head">
      <Link className="pf-back" href="/account"><ArrowLeft size={16} aria-hidden="true" />{t.parcel.back}</Link>
      <h1>{t.documents.title}</h1>
      <p>{t.documents.lead}</p>
      <nav className="pf-anchors" aria-label={t.documents.title}><a href="#passports">{t.documents.passports}</a><a href="#declarations">{t.documents.declarations}</a></nav>
    </header>
    <IdentityView embedded />
    <DeclarationView embedded />
  </div>;
}

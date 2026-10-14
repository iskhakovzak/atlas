import type {Metadata} from 'next';
import {appAuthLink} from '@/lib/auth/core';
import {safeReturnTo} from '@/lib/auth/return-to';
import {pageLocale} from '../../page-locale';
import {privateRouteMetadata} from '../../route-metadata';
import {AuthReturnView} from '../../auth-return-view';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../../styles/link-pages.css';
import '../../styles/member-pages.css';

// The system browser lands here after a sign-in started by the Atlas app; the page hands the
// single-use code back to the app through its URL scheme. Nothing is rendered for a malformed code.
export const metadata:Metadata=privateRouteMetadata;
export const dynamic='force-dynamic';

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const code=typeof params.code==='string'&&/^[A-Za-z0-9_-]{24}$/.test(params.code)?params.code:null;
 const returnTo=safeReturnTo(typeof params.return_to==='string'?params.return_to:null);
 return <AuthReturnView locale={await pageLocale()} appUrl={code?appAuthLink(code,returnTo):null}/>;
}

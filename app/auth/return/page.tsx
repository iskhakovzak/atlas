import type {Metadata} from 'next';
import {appAuthLink} from '@/lib/auth/core';
import {safeReturnTo} from '@/lib/auth/return-to';
import {pageLocale} from '../../page-locale';
import {privateRouteMetadata} from '../../route-metadata';
import {AuthReturnView} from '../../auth-return-view';

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

'use client';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {pickLocale} from '@/lib/market/uz-cyrl';
import type {Locale} from '@/lib/market/i18n';
// Apart from app/market-ui.tsx (14.10.2026): market-ui is on every page, and this window pulls Radix Dialog, ui/button and
// the shared utils chunk (tailwind-merge) into it. Pages that open a window import it from here.
export function Modal({open,onClose,title,description,children,locale='ru'}:{open:boolean;onClose:()=>void;title:string;description:string;children:ReactNode;locale?:Locale}){return <Dialog open={open} onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="atlas-modal" showCloseButton={false}><DialogClose asChild><button className="icon-btn modal-close" aria-label={pickLocale({ru:'Закрыть',uz:'Yopish',en:'Close'}, locale)}><X size={20}/></button></DialogClose><DialogTitle className="modal-title">{title}</DialogTitle><DialogDescription>{description}</DialogDescription>{children}</DialogContent></Dialog>}

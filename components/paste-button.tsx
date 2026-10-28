'use client';

import { useRef, useState } from 'react';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { isUzbek, type Locale } from '@/lib/market/i18n';
import { uzText } from '@/lib/market/uz-cyrl';
import { extractSharedLink } from '@/lib/market/shared-link';
import { toast } from '@/lib/market/toast';
import { isNative, readClipboardAfterTap } from '@/lib/native/bridge';

/** Reads only after a tap. `ready`: the clipboard already holds a store link (app/use-clipboard-link.ts), so the button
 *  lights up; the caller decides what a pasted link does (the link pages open its calculation). */
export function PasteButton({ targetId, locale, onPaste, disabled = false, multiline = false, ready = false }: {
  targetId: string; locale: Locale; onPaste: (text: string) => void; disabled?: boolean; multiline?: boolean; ready?: boolean;
}) {
  const [reading, setReading] = useState(false);
  const pending = useRef(false);
  const label = locale === 'ru' ? 'Вставить' : isUzbek(locale) ? uzText(locale, 'Qo‘yish') : 'Paste';
  const hint = locale === 'ru' ? 'Нажмите и удерживайте поле → «Вставить». На компьютере — Ctrl+V или ⌘V.' : isUzbek(locale)
    ? uzText(locale, 'Maydonni bosib turing → «Qo‘yish». Kompyuterda — Ctrl+V yoki ⌘V.')
    : 'Touch and hold the field → Paste. On a computer, use Ctrl+V or ⌘V.';
  async function paste(button: HTMLButtonElement) {
    if (disabled || pending.current) return;
    const field = document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null;
    const before = field?.value;
    pending.current = true; setReading(true);
    try {
      // Inside the Atlas apps the web view's clipboard API is unreliable: the native plugin reads it (iOS asks to allow).
      const text = (isNative() ? await readClipboardAfterTap() : await navigator.clipboard.readText()).trim();
      // Do not replace text entered while a permission prompt was open, or a field on another page.
      if (!field?.isConnected || field.value !== before || field.disabled) return;
      if (!text) { toast.message(hint); return; }
      onPaste(multiline ? [before?.trim(), text].filter(Boolean).join('\n') : extractSharedLink(text) || text);
    } catch { toast.message(hint); }
    finally {
      pending.current = false; setReading(false);
      if (field?.isConnected && [button, field, document.body].includes(document.activeElement as HTMLElement)) field.focus({ preventScroll: true });
    }
  }
  const readyLabel = locale === 'ru' ? 'Вставить скопированную ссылку' : isUzbek(locale) ? uzText(locale, 'Nusxalangan havolani qo‘yish') : 'Paste the copied link';
  return <button type="button" className={'paste-button' + (ready && !reading ? ' is-ready' : '')} aria-label={ready ? readyLabel : undefined} title={ready ? readyLabel : undefined} disabled={disabled || reading} aria-controls={targetId} aria-busy={reading} onClick={event => void paste(event.currentTarget)}>
    {reading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <ClipboardPaste size={16} aria-hidden="true" />}<span>{label}</span>
  </button>;
}

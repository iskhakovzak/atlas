'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { dedupeSafeImages } from '@/lib/importer/extract';
import { gallerySwipeStep } from '@/lib/market/gallery';
import type { Product } from '@/lib/market/domain';

/**
 * UI-only gallery: selected photos never change the purchased variant or its price.
 * The photos sit side by side in a horizontal scroller that snaps one photo at a time: a finger or trackpad
 * moves the photo along and it settles on the next one; arrows, thumbnails and the keyboard scroll there
 * smoothly; a mouse can drag it. Under reduced motion the jump is instant.
 */
export function ProductGallery({ product, images, activeImage, onImageChange, locale = 'ru', compact = false }: {
  product: Product; images?: string[]; activeImage?: string; onImageChange?: (image: string) => void;
  locale?: 'ru' | 'uz' | 'en'; compact?: boolean;
}) {
  const photos = dedupeSafeImages(images ?? [product.image, ...(product.sourceImages ?? [])], product.sourceUrl ?? 'https://atlasmarket.uz/', 12);
  const [selection, setSelection] = useState('');
  const [failed, setFailed] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number } | null>(null);
  const settle = useRef<number | undefined>(undefined);
  const wanted = activeImage ?? selection;
  const index = Math.max(0, photos.indexOf(wanted));
  const copy = {
    ru: { gallery: 'Фотографии товара', previous: 'Предыдущее фото', next: 'Следующее фото', hint: 'Листайте фото влево или вправо', photo: 'Фото', of: 'из', missing: 'Фото недоступно' },
    uz: { gallery: 'Tovar suratlari', previous: 'Oldingi surat', next: 'Keyingi surat', hint: 'Suratni chapga yoki o‘ngga suring', photo: 'Surat', of: '/', missing: 'Surat mavjud emas' },
    en: { gallery: 'Product photos', previous: 'Previous photo', next: 'Next photo', hint: 'Swipe left or right to browse photos', photo: 'Photo', of: 'of', missing: 'Photo unavailable' },
  }[locale];
  const smooth = () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' as const : 'auto' as const;
  function shownIndex() {
    const el = stage.current;
    return el && el.clientWidth ? Math.round(el.scrollLeft / el.clientWidth) : index;
  }
  function select(position: number) {
    const value = photos[Math.max(0, Math.min(photos.length - 1, position))];
    if (!value || value === wanted) return;
    setSelection(value);
    onImageChange?.(value);
  }
  function scrollTo(position: number, behavior: ScrollBehavior = smooth()) {
    const el = stage.current, next = Math.max(0, Math.min(photos.length - 1, position));
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior });
    select(next);
  }
  // A photo chosen outside (a colour that has its own photo) slides into view.
  useEffect(() => {
    const el = stage.current;
    if (el && !drag.current && shownIndex() !== index) el.scrollTo({ left: index * el.clientWidth, behavior: smooth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);
  useEffect(() => () => window.clearTimeout(settle.current), []);
  function onScroll() {
    // The counter and thumbnails follow once the photo has settled.
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => { if (!drag.current) select(shownIndex()); }, 90);
  }
  // Touch and trackpads scroll natively; a mouse drags the strip and lets go onto the next photo.
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || photos.length < 2 || (event.target as HTMLElement).closest('button')) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (origin && origin.id === event.pointerId) event.currentTarget.scrollLeft = origin.left - (event.clientX - origin.x);
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (!origin || origin.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    const from = Math.round(origin.left / (event.currentTarget.clientWidth || 1));
    scrollTo(from + gallerySwipeStep(event.clientX - origin.x, event.clientY - origin.y, event.currentTarget.clientWidth));
  }
  return <div className={`product-gallery${compact ? ' product-gallery-compact' : ''}`} role="group" aria-label={copy.gallery}>
    <div ref={stage} className={`product-gallery-stage${dragging ? ' dragging' : ''}`} tabIndex={photos.length > 1 ? 0 : undefined}
      aria-label={photos.length > 1 ? `${copy.hint}. ${copy.photo} ${index + 1} ${copy.of} ${photos.length}` : undefined}
      onScroll={onScroll} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={() => { if (drag.current) { const from = Math.round(drag.current.left / (stage.current?.clientWidth || 1)); drag.current = null; setDragging(false); scrollTo(from); } }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); scrollTo(index + (event.key === 'ArrowLeft' ? -1 : 1)); } }}>
      {photos.length ? photos.map((photo, position) => <div className="product-gallery-slide" key={photo} aria-hidden={position !== index}>
        {!failed.includes(photo)
          // Merchant photos remain safe public HTTPS URLs, without proxying.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="product-img" src={photo} alt={`${product.name} — ${copy.photo} ${position + 1}`} loading={position === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(current => [...current, photo])}/>
          : <div className="no-photo"><Package size={32}/><span>{copy.missing}</span></div>}
      </div>) : <div className="product-gallery-slide"><div className="no-photo"><Package size={32}/><span>{copy.missing}</span></div></div>}
    </div>
    {photos.length > 1 && <>
      <div className="product-gallery-controls">
        <button type="button" aria-label={copy.previous} disabled={index === 0} onClick={() => scrollTo(index - 1)}><ChevronLeft size={20}/></button>
        <span aria-live="polite" aria-atomic="true">{index + 1} / {photos.length}</span>
        <button type="button" aria-label={copy.next} disabled={index === photos.length - 1} onClick={() => scrollTo(index + 1)}><ChevronRight size={20}/></button>
      </div>
      {!compact && <><p className="product-gallery-hint">{copy.hint}</p><div className="product-gallery-thumbnails">
        {photos.map((item, position) => <button type="button" key={item} aria-label={`${copy.photo} ${position + 1}`} aria-pressed={position === index} onClick={() => scrollTo(position)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false}/>
        </button>)}
      </div></>}
    </>}
  </div>;
}

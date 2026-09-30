'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { dedupeSafeImages } from '@/lib/importer/extract';
import { gallerySwipeStep } from '@/lib/market/gallery';
import type { Product } from '@/lib/market/domain';

/** UI-only gallery: selected photos never change the purchased variant or its price. */
export function ProductGallery({ product, images, activeImage, onImageChange, locale = 'ru', compact = false }: {
  product: Product; images?: string[]; activeImage?: string; onImageChange?: (image: string) => void;
  locale?: 'ru' | 'uz' | 'en'; compact?: boolean;
}) {
  const photos = dedupeSafeImages(images ?? [product.image, ...(product.sourceImages ?? [])], product.sourceUrl ?? 'https://atlasmarket.uz/', 12);
  const [selection, setSelection] = useState('');
  const [failed, setFailed] = useState<string[]>([]);
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const wanted = activeImage ?? selection;
  const index = Math.max(0, photos.indexOf(wanted));
  const photo = photos[index];
  const copy = {
    ru: { gallery: 'Фотографии товара', previous: 'Предыдущее фото', next: 'Следующее фото', hint: 'Листайте фото влево или вправо', photo: 'Фото', of: 'из', missing: 'Фото недоступно' },
    uz: { gallery: 'Tovar suratlari', previous: 'Oldingi surat', next: 'Keyingi surat', hint: 'Suratni chapga yoki o‘ngga suring', photo: 'Surat', of: '/', missing: 'Surat mavjud emas' },
    en: { gallery: 'Product photos', previous: 'Previous photo', next: 'Next photo', hint: 'Swipe left or right to browse photos', photo: 'Photo', of: 'of', missing: 'Photo unavailable' },
  }[locale];
  function choose(next: number) {
    const value = photos[Math.max(0, Math.min(photos.length - 1, next))];
    if (!value) return;
    setSelection(value);
    onImageChange?.(value);
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    start.current = null;
    if (!origin || origin.id !== event.pointerId) return;
    const step = gallerySwipeStep(event.clientX - origin.x, event.clientY - origin.y, event.currentTarget.clientWidth);
    if (step) choose(index + step);
  }
  return <div className={`product-gallery${compact ? ' product-gallery-compact' : ''}`} role="group" aria-label={copy.gallery}>
    <div className="product-gallery-stage" tabIndex={photos.length > 1 ? 0 : undefined}
      aria-label={photos.length > 1 ? `${copy.hint}. ${copy.photo} ${index + 1} ${copy.of} ${photos.length}` : undefined}
      onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { start.current = null; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); choose(index + (event.key === 'ArrowLeft' ? -1 : 1)); } }}>
      {photo && !failed.includes(photo)
        // Merchant photos remain safe public HTTPS URLs, without proxying.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="product-img" src={photo} alt={`${product.name} — ${copy.photo} ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(current => [...current, photo])}/>
        : <div className="no-photo"><Package size={32}/><span>{copy.missing}</span></div>}
    </div>
    {photos.length > 1 && <>
      <div className="product-gallery-controls">
        <button type="button" aria-label={copy.previous} disabled={index === 0} onClick={() => choose(index - 1)}><ChevronLeft size={20}/></button>
        <span aria-live="polite" aria-atomic="true">{index + 1} / {photos.length}</span>
        <button type="button" aria-label={copy.next} disabled={index === photos.length - 1} onClick={() => choose(index + 1)}><ChevronRight size={20}/></button>
      </div>
      {!compact && <><p className="product-gallery-hint">{copy.hint}</p><div className="product-gallery-thumbnails">
        {photos.map((item, position) => <button type="button" key={item} aria-label={`${copy.photo} ${position + 1}`} aria-pressed={position === index} onClick={() => choose(position)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false}/>
        </button>)}
      </div></>}
    </>}
  </div>;
}

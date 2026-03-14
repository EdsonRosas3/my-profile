'use client';

import { useEffect, useRef, useState } from 'react';
import type { TocItem } from '@/lib/content/markdown.service';

// ---------------------------------------------------------------------------
// Hook compartido: detecta qué heading está visible en pantalla
// ---------------------------------------------------------------------------
function useActiveHeading(items: TocItem[]) {
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (items.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [items]);

  return activeId;
}

// ---------------------------------------------------------------------------
// Lista interna de links (reutilizada en desktop y en el drawer mobile)
// ---------------------------------------------------------------------------
function TocList({
  items,
  activeId,
  onLinkClick,
}: {
  items: TocItem[];
  activeId: string;
  onLinkClick?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.id} style={{ paddingLeft: `${(item.depth - 2) * 12}px` }}>
          <a
            href={`#${item.id}`}
            onClick={onLinkClick}
            className={`block rounded px-2 py-1 text-sm transition-colors duration-150 ${
              activeId === item.id
                ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200'
            }`}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Desktop: sidebar sticky con scroll tracking
// ---------------------------------------------------------------------------
export function TableOfContents({ items }: { items: TocItem[] }) {
  const activeId = useActiveHeading(items);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Tabla de contenidos">
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        Contenido
      </p>
      <TocList items={items} activeId={activeId} />
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Mobile: botón flotante (FAB) + drawer animado desde abajo
// ---------------------------------------------------------------------------
export function MobileToc({ items }: { items: TocItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeId = useActiveHeading(items);

  // Bloquear scroll del body mientras el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  if (items.length === 0) return null;

  return (
    <>
      {/* FAB — botón flotante */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Abrir tabla de contenidos"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
      >
        <IconList />
      </button>

      {/* Overlay + Drawer — siempre en el DOM, animado con clases */}
      <div
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={close}
        />

        {/* Drawer */}
        <div
          className={`absolute bottom-0 left-0 right-0 flex max-h-[80svh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-zinc-900 ${
            isOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Header del drawer */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              Tabla de contenidos
            </span>
            <button
              onClick={close}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <IconClose />
            </button>
          </div>

          {/* Lista scrollable */}
          <div className="overflow-y-auto px-4 py-3 pb-8">
            <TocList items={items} activeId={activeId} onLinkClick={close} />
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Iconos inline (sin dependencia extra)
// ---------------------------------------------------------------------------
function IconList() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

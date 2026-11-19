// src/hooks/useDraggable.ts
// Modales déplaçables par l'en-tête.
// - useGlobalModalDrag() : délégation globale (montée une fois dans le layout)
//   pour toutes les .mantine-Modal-content.
// - useDraggable() : pour les fenêtres maison.
// La boîte confirm() native Tauri n'est pas concernée.
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

const VISIBLE = 40; // px toujours visibles
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], .mantine-Modal-close';

/** Limite le déplacement pour garder 40 px de l'en-tête dans la fenêtre. */
function clamp(rect: DOMRect, base: { x: number; y: number }, dx: number, dy: number) {
  const left0 = rect.left - base.x;
  const top0 = rect.top - base.y;
  const minX = VISIBLE - rect.width - left0;
  const maxX = window.innerWidth - VISIBLE - left0;
  const minY = -top0;
  const maxY = window.innerHeight - VISIBLE - top0;
  return {
    x: Math.min(maxX, Math.max(minX, dx)),
    y: Math.min(maxY, Math.max(minY, dy)),
  };
}

const offsets = new WeakMap<HTMLElement, { x: number; y: number }>();

export function useGlobalModalDrag(): void {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const header = target.closest('.mantine-Modal-header') as HTMLElement | null;
      if (!header || target.closest(INTERACTIVE)) return;
      const content = header.closest('.mantine-Modal-content') as HTMLElement | null;
      if (!content) return;
      // Plein écran : rien à déplacer
      if (content.getBoundingClientRect().width >= window.innerWidth - 1) return;

      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      const base = offsets.get(content) ?? { x: 0, y: 0 };
      const rect = content.getBoundingClientRect();

      const onMove = (ev: MouseEvent) => {
        const next = clamp(rect, base, base.x + ev.clientX - start.x, base.y + ev.clientY - start.y);
        offsets.set(content, next);
        content.style.transform = `translate(${next.x}px, ${next.y}px)`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
      };
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);
}

/**
 * Pour une fenêtre maison :
 *   const drag = useDraggable(opened);
 *   <div ref={drag.ref} style={drag.style}>
 *     <div {...drag.handleProps}>En-tête</div>
 * Recentrée (offset remis à zéro) à chaque ouverture.
 */
export function useDraggable<T extends HTMLElement = HTMLDivElement>(opened = true) {
  const ref = useRef<T | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => { if (opened) setPos({ x: 0, y: 0 }); }, [opened]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const base = posRef.current;
    const rect = el.getBoundingClientRect();
    const onMove = (ev: MouseEvent) =>
      setPos(clamp(rect, base, base.x + ev.clientX - start.x, base.y + ev.clientY - start.y));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return {
    ref,
    style: { transform: `translate(${pos.x}px, ${pos.y}px)` } as React.CSSProperties,
    handleProps: { onMouseDown, style: { cursor: 'move' } as React.CSSProperties },
    reset: () => setPos({ x: 0, y: 0 }),
  };
}

export default useDraggable;

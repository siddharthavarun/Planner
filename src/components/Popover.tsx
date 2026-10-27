import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type Anchor = HTMLElement | DOMRect | { x: number; y: number };

function anchorRect(anchor: Anchor): DOMRect {
  if (anchor instanceof HTMLElement) return anchor.getBoundingClientRect();
  if (anchor instanceof DOMRect) return anchor;
  return new DOMRect(anchor.x, anchor.y, 0, 0);
}

interface PopoverProps {
  anchor: Anchor;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
  /** Keep focus where it is (e.g. in a textarea driving the slash menu). */
  passive?: boolean;
}

export function Popover({ anchor, onClose, children, className, align = 'start', passive }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = anchorRect(anchor);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 8;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - margin && r.top - h - 4 > margin) top = r.top - h - 4;
    top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    setPos({ top, left });
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchor instanceof HTMLElement && anchor.contains(target)) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('mousedown', onDown, true);
    if (!passive) document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, passive]);

  return createPortal(
    <div
      ref={ref}
      className={`popover ${className ?? ''}`}
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
      onMouseDown={passive ? (e) => e.preventDefault() : undefined}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  hint?: string;
}

export function Menu({ items, onClose }: { items: (MenuItem | 'sep')[]; onClose: () => void }) {
  return (
    <div className="menu">
      {items.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            className={`menu-item ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            {item.icon && <span className="menu-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
            {item.hint && <span className="menu-hint">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}

/** Hook for the common "button opens a popover" pattern. */
export function usePopover() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  return {
    anchor,
    open: (a: Anchor) => setAnchor(a),
    toggle: (el: HTMLElement) => setAnchor((cur) => (cur ? null : el)),
    close: () => setAnchor(null),
  };
}

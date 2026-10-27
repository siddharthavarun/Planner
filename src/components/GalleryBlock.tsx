import { useState } from 'react';
import type { GalleryData, GalleryItem } from '../types';
import { COVER_COLORS, DEFAULT_COVER_COUNT, uid } from '../utils';
import { CloseIcon, ImageIcon, PlusIcon } from './Icons';
import { Popover, type Anchor } from './Popover';
import { CoverPicker, coverStyle } from './Pickers';

/** A small grid of picture cards inside a goal: a vision board, milestones, places, etc. */
export function GalleryBlock({
  gallery,
  onChange,
}: {
  gallery: GalleryData;
  onChange: (g: GalleryData) => void;
}) {
  const [picker, setPicker] = useState<{ id: string; anchor: Anchor } | null>(null);
  const { items, size } = gallery;

  const setItem = (id: string, patch: Partial<GalleryItem>) =>
    onChange({ ...gallery, items: items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const addItem = () =>
    onChange({
      ...gallery,
      items: [
        ...items,
        {
          id: uid(),
          title: '',
          note: '',
          cover: { kind: 'color', value: COVER_COLORS[(items.length * 3) % DEFAULT_COVER_COUNT] },
        },
      ],
    });
  const removeItem = (id: string) => onChange({ ...gallery, items: items.filter((it) => it.id !== id) });
  const pickerItem = picker && items.find((it) => it.id === picker.id);

  return (
    <div className={`gallery-block size-${size}`}>
      <div className="gallery-block-bar">
        <div className="seg" role="radiogroup" aria-label="Card size">
          {(['small', 'medium'] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={size === s}
              className={size === s ? 'on' : ''}
              onClick={() => onChange({ ...gallery, size: s })}
            >
              {s === 'small' ? 'Small' : 'Medium'}
            </button>
          ))}
        </div>
      </div>
      <div className="gallery-block-grid">
        {items.map((it) => (
          <div key={it.id} className="gb-card">
            <button
              className={`gb-cover ${it.cover ? '' : 'empty'}`}
              style={coverStyle(it.cover)}
              onClick={(e) => setPicker({ id: it.id, anchor: e.currentTarget })}
              aria-label="Change picture"
            >
              {!it.cover && <ImageIcon />}
              <span className="gb-cover-hint">
                <ImageIcon /> Picture
              </span>
            </button>
            <button className="gb-remove" onClick={() => removeItem(it.id)} aria-label="Remove card">
              <CloseIcon width={12} height={12} />
            </button>
            <input
              className="gb-title"
              placeholder="Title"
              value={it.title}
              onChange={(e) => setItem(it.id, { title: e.target.value })}
            />
            <input
              className="gb-note"
              placeholder="Add a note"
              value={it.note}
              onChange={(e) => setItem(it.id, { note: e.target.value })}
            />
          </div>
        ))}
        <button className="gb-card gb-add" onClick={addItem}>
          <PlusIcon /> Add card
        </button>
      </div>

      {picker && pickerItem && (
        <Popover anchor={picker.anchor} onClose={() => setPicker(null)}>
          <CoverPicker
            onPick={(cover) => {
              setItem(picker.id, { cover });
              setPicker(null);
            }}
            onRemove={
              pickerItem.cover
                ? () => {
                    setItem(picker.id, { cover: null });
                    setPicker(null);
                  }
                : undefined
            }
          />
        </Popover>
      )}
    </div>
  );
}

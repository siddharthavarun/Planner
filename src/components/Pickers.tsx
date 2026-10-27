import { useState } from 'react';
import type { Cover, Priority, Status } from '../types';
import { PRIORITIES, STATUSES } from '../types';
import {
  COVER_COLORS,
  EMOJIS,
  PRIORITY_COLORS,
  STATUS_COLORS,
  imageFileToDataUrl,
  pickImageFile,
} from '../utils';
import { ImageIcon, UploadIcon } from './Icons';

export function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`pill pill-${color}`}>{children}</span>;
}

export function PriorityPill({ value }: { value: Priority | null }) {
  if (!value) return null;
  return <Pill color={PRIORITY_COLORS[value]}>{value}</Pill>;
}

export function StatusPill({ value }: { value: Status }) {
  return (
    <Pill color={STATUS_COLORS[value]}>
      <span className="status-dot" />
      {value}
    </Pill>
  );
}

export function PriorityPicker({
  value,
  onPick,
}: {
  value: Priority | null;
  onPick: (p: Priority | null) => void;
}) {
  return (
    <div className="option-list">
      {PRIORITIES.map((p) => (
        <button key={p} className={`option ${p === value ? 'selected' : ''}`} onClick={() => onPick(p)}>
          <PriorityPill value={p} />
        </button>
      ))}
      <div className="menu-sep" />
      <button className="option muted" onClick={() => onPick(null)}>
        Clear
      </button>
    </div>
  );
}

export function StatusPicker({ value, onPick }: { value: Status; onPick: (s: Status) => void }) {
  return (
    <div className="option-list">
      {STATUSES.map((s) => (
        <button key={s} className={`option ${s === value ? 'selected' : ''}`} onClick={() => onPick(s)}>
          <StatusPill value={s} />
        </button>
      ))}
    </div>
  );
}

export function EmojiPicker({
  onPick,
  onRemove,
}: {
  onPick: (emoji: string) => void;
  onRemove?: () => void;
}) {
  const [custom, setCustom] = useState('');
  return (
    <div className="emoji-picker">
      <div className="emoji-picker-head">
        <input
          className="input"
          placeholder="Type or paste any emoji…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && custom.trim()) onPick(custom.trim());
          }}
        />
        <button
          className="btn"
          onClick={() => onPick(EMOJIS[Math.floor(Math.random() * EMOJIS.length)])}
          title="Random"
        >
          🎲
        </button>
        {onRemove && (
          <button className="btn" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="emoji-grid">
        {EMOJIS.map((e) => (
          <button key={e} className="emoji-btn" onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CoverPicker({
  onPick,
  onRemove,
}: {
  onPick: (cover: Cover) => void;
  onRemove?: () => void;
}) {
  const [tab, setTab] = useState<'gallery' | 'upload' | 'link'>('gallery');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onPick({ kind: 'image', src: await imageFileToDataUrl(file), posY: 50 });
    } catch {
      setError('Could not read that image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cover-picker">
      <div className="tabs">
        {(['gallery', 'upload', 'link'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'gallery' ? 'Colors' : t === 'upload' ? 'Upload' : 'Link'}
          </button>
        ))}
        <span className="spacer" />
        {onRemove && (
          <button className="tab" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      {tab === 'gallery' && (
        <div className="cover-grid">
          {COVER_COLORS.map((c) => (
            <button
              key={c}
              className="cover-swatch"
              style={{ background: c }}
              onClick={() => onPick({ kind: 'color', value: c })}
              aria-label="Cover color"
            />
          ))}
        </div>
      )}
      {tab === 'upload' && (
        <div
          className="drop-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files[0]);
          }}
        >
          <button className="btn primary" disabled={busy} onClick={async () => upload(await pickImageFile())}>
            <UploadIcon /> {busy ? 'Processing…' : 'Choose an image'}
          </button>
          <p className="muted small">or drop one here. Large images are resized automatically.</p>
          {error && <p className="error small">{error}</p>}
        </div>
      )}
      {tab === 'link' && (
        <form
          className="link-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) onPick({ kind: 'image', src: url.trim(), posY: 50 });
          }}
        >
          <input
            className="input"
            placeholder="Paste an image link…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <button className="btn primary" type="submit">
            <ImageIcon /> Use image
          </button>
        </form>
      )}
    </div>
  );
}

export function coverStyle(cover: Cover | null): React.CSSProperties | undefined {
  if (!cover) return undefined;
  if (cover.kind === 'color') return { background: cover.value };
  return {
    backgroundImage: `url("${cover.src.replace(/"/g, '%22')}")`,
    backgroundSize: 'cover',
    backgroundPosition: `center ${cover.posY}%`,
  };
}

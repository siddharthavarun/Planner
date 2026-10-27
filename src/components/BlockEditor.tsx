import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
} from 'react';
import { newBlock } from '../store';
import type { Block, BlockType } from '../types';
import { imageFileToDataUrl, pickImageFile, uid } from '../utils';
import { AutoTextarea } from './AutoTextarea';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloseIcon,
  CopyIcon,
  GripIcon,
  ImageIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from './Icons';
import { Menu, Popover, usePopover } from './Popover';
import { EmojiPicker } from './Pickers';

interface BlockKind {
  type: BlockType;
  label: string;
  desc: string;
  glyph: string;
  keywords: string;
}

export const BLOCK_KINDS: BlockKind[] = [
  { type: 'paragraph', label: 'Text', desc: 'Plain text', glyph: 'Aa', keywords: 'text paragraph plain' },
  { type: 'h1', label: 'Heading 1', desc: 'Big section heading', glyph: 'H1', keywords: 'heading title h1' },
  { type: 'h2', label: 'Heading 2', desc: 'Medium section heading', glyph: 'H2', keywords: 'heading subtitle h2' },
  { type: 'h3', label: 'Heading 3', desc: 'Small section heading', glyph: 'H3', keywords: 'heading h3' },
  { type: 'todo', label: 'To-do list', desc: 'Track tasks with checkboxes', glyph: '☑', keywords: 'todo task checkbox checklist' },
  { type: 'bulleted', label: 'Bulleted list', desc: 'A simple bulleted list', glyph: '•', keywords: 'bullet list unordered' },
  { type: 'numbered', label: 'Numbered list', desc: 'A list with numbering', glyph: '1.', keywords: 'number list ordered' },
  { type: 'toggle', label: 'Toggle', desc: 'Collapsible section', glyph: '▸', keywords: 'toggle collapse expand details' },
  { type: 'table', label: 'Table', desc: 'Rows and columns', glyph: '▦', keywords: 'table grid rows columns spreadsheet' },
  { type: 'callout', label: 'Callout', desc: 'Make text stand out', glyph: '💡', keywords: 'callout note highlight info' },
  { type: 'quote', label: 'Quote', desc: 'Capture a quote', glyph: '❝', keywords: 'quote citation blockquote' },
  { type: 'image', label: 'Image', desc: 'Upload or embed an image', glyph: '🖼', keywords: 'image picture photo upload' },
  { type: 'code', label: 'Code', desc: 'Monospaced snippet', glyph: '</>', keywords: 'code snippet monospace' },
  { type: 'divider', label: 'Divider', desc: 'Visually divide blocks', glyph: '—', keywords: 'divider line separator hr' },
];

const LIST_TYPES: BlockType[] = ['bulleted', 'numbered', 'todo'];
const INDENTABLE: BlockType[] = ['paragraph', 'bulleted', 'numbered', 'todo'];
const isTextual = (t: BlockType) => t !== 'divider' && t !== 'table' && t !== 'image';

const MARKDOWN: [string, BlockType][] = [
  ['# ', 'h1'],
  ['## ', 'h2'],
  ['### ', 'h3'],
  ['- ', 'bulleted'],
  ['* ', 'bulleted'],
  ['1. ', 'numbered'],
  ['[] ', 'todo'],
  ['[ ] ', 'todo'],
  ['> ', 'toggle'],
  ['" ', 'quote'],
  ['```', 'code'],
];

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bulleted: 'List',
  numbered: 'List',
  todo: 'To-do',
  toggle: 'Toggle',
  quote: 'Empty quote',
  callout: 'Type something…',
  code: 'Code',
};

function listNumber(blocks: Block[], index: number): number {
  const indent = blocks[index].indent ?? 0;
  let n = 1;
  for (let j = index - 1; j >= 0; j--) {
    const b = blocks[j];
    const bi = b.indent ?? 0;
    if (bi > indent) continue;
    if (bi === indent && b.type === 'numbered') n++;
    else break;
  }
  return n;
}

/** Converts a block to another type, keeping its text where it makes sense. */
function convert(block: Block, type: BlockType): Block {
  const fresh = newBlock(type, isTextual(type) ? block.text : '');
  return {
    ...fresh,
    id: block.id,
    indent: INDENTABLE.includes(type) ? block.indent : undefined,
    checked: type === 'todo' ? (block.checked ?? false) : undefined,
  };
}

type FocusPos = number | 'start' | 'end';

interface SlashState {
  blockId: string;
  start: number;
  query: string;
  index: number;
}

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  focusFirstRef?: MutableRefObject<() => void>;
  onExitTop?: () => void;
}

export function BlockEditor({ blocks, onChange, focusFirstRef, onExitTop }: Props) {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ id: string; pos: FocusPos; field?: string } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; before: boolean } | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const commit = (next: Block[]) => {
    blocksRef.current = next;
    onChange(next);
  };

  // Focus is applied after the next commit: the target may be new, or may remount
  // when its block type changes.
  const focusBlock = (id: string, pos: FocusPos, field?: string) => {
    pendingFocus.current = { id, pos, field };
    rerender();
  };

  const applyFocus = () => {
    const req = pendingFocus.current;
    if (!req) return;
    const sel = `[data-block-id="${req.id}"] [data-field="${req.field ?? 'text'}"]`;
    const el = rootRef.current?.querySelector<HTMLTextAreaElement>(sel);
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
    const len = el.value.length;
    const p = req.pos === 'start' ? 0 : req.pos === 'end' ? len : Math.min(req.pos, len);
    el.setSelectionRange(p, p);
  };

  useLayoutEffect(applyFocus);

  if (focusFirstRef) {
    focusFirstRef.current = () => {
      const first = blocksRef.current.find((b) => isTextual(b.type));
      if (first) focusBlock(first.id, 'start');
      else {
        const b = newBlock();
        commit([b, ...blocksRef.current]);
        focusBlock(b.id, 'start');
      }
    };
  }

  const update = (id: string, patch: Partial<Block>) =>
    commit(blocksRef.current.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const insertAt = (index: number, block: Block) => {
    const next = [...blocksRef.current];
    next.splice(index, 0, block);
    commit(next);
  };

  const remove = (id: string) => commit(blocksRef.current.filter((b) => b.id !== id));

  const textualNeighbor = (index: number, dir: -1 | 1): Block | undefined => {
    const list = blocksRef.current;
    for (let i = index + dir; i >= 0 && i < list.length; i += dir) {
      if (isTextual(list[i].type)) return list[i];
    }
    return undefined;
  };

  /** Places a new block of `type` after `index` and focuses it. */
  const addBlockAfter = (index: number, type: BlockType) => {
    const b = newBlock(type);
    const extra: Block[] = [b];
    // A divider can't hold the caret, so give the user somewhere to keep typing.
    if (type === 'divider' && !blocksRef.current[index + 1]) extra.push(newBlock());
    const next = [...blocksRef.current];
    next.splice(index + 1, 0, ...extra);
    commit(next);
    if (isTextual(type)) focusBlock(b.id, 'start');
    else if (type === 'table') focusBlock(b.id, 'start', 'cell-0-0');
    else if (type === 'divider') focusBlock(next[index + 2].id, 'start');
  };

  const turnInto = (id: string, type: BlockType) => {
    const index = blocksRef.current.findIndex((b) => b.id === id);
    const block = blocksRef.current[index];
    if (!block) return;
    if (!isTextual(type) && block.text.trim()) {
      addBlockAfter(index, type);
      return;
    }
    commit(blocksRef.current.map((b) => (b.id === id ? convert(b, type) : b)));
    if (isTextual(type)) focusBlock(id, 'end');
    else if (type === 'table') focusBlock(id, 'start', 'cell-0-0');
    else if (type === 'divider') {
      if (!blocksRef.current[index + 1]) {
        const p = newBlock();
        insertAt(index + 1, p);
        focusBlock(p.id, 'start');
      } else if (isTextual(blocksRef.current[index + 1].type)) {
        focusBlock(blocksRef.current[index + 1].id, 'start');
      }
    }
  };

  const moveBlock = (id: string, targetId: string | null, before: boolean) => {
    if (id === targetId) return;
    const list = blocksRef.current;
    const moving = list.find((b) => b.id === id);
    if (!moving) return;
    const rest = list.filter((b) => b.id !== id);
    let idx = targetId ? rest.findIndex((b) => b.id === targetId) : rest.length;
    if (idx < 0) idx = rest.length;
    else if (targetId && !before) idx++;
    rest.splice(idx, 0, moving);
    commit(rest);
  };

  // ---------- slash menu ----------

  const slashMatches = slash
    ? BLOCK_KINDS.filter((k) => {
        const q = slash.query.toLowerCase();
        return !q || k.label.toLowerCase().includes(q) || k.keywords.includes(q);
      })
    : [];

  const applySlash = (kind: BlockKind) => {
    if (!slash) return;
    const block = blocksRef.current.find((b) => b.id === slash.blockId);
    setSlash(null);
    if (!block) return;
    const text = block.text.slice(0, slash.start) + block.text.slice(slash.start + 1 + slash.query.length);
    if (text.trim() === '') {
      commit(blocksRef.current.map((b) => (b.id === block.id ? { ...b, text: '' } : b)));
      turnInto(block.id, kind.type);
    } else {
      update(block.id, { text });
      addBlockAfter(blocksRef.current.findIndex((b) => b.id === block.id), kind.type);
    }
  };

  // ---------- text handlers ----------

  const onTextChange = (block: Block, el: HTMLTextAreaElement) => {
    const value = el.value;
    const caret = el.selectionStart;

    if (block.type === 'paragraph') {
      for (const [prefix, type] of MARKDOWN) {
        if (value.startsWith(prefix) && caret === prefix.length && block.text.length < value.length) {
          commit(
            blocksRef.current.map((b) =>
              b.id === block.id ? { ...convert(b, type), text: value.slice(prefix.length) } : b,
            ),
          );
          focusBlock(block.id, 'start');
          return;
        }
      }
      if (value === '---' && block.text === '--') {
        commit(blocksRef.current.map((b) => (b.id === block.id ? { ...b, text: '' } : b)));
        turnInto(block.id, 'divider');
        return;
      }
    }

    update(block.id, { text: value });

    if (slash && slash.blockId === block.id) {
      if (caret <= slash.start || value[slash.start] !== '/') setSlash(null);
      else {
        const query = value.slice(slash.start + 1, caret);
        if (/\s{2}|\n/.test(query) || query.length > 24) setSlash(null);
        else setSlash({ ...slash, query, index: 0 });
      }
    } else if (
      block.type !== 'code' &&
      value.length === block.text.length + 1 &&
      value[caret - 1] === '/' &&
      (caret === 1 || /\s/.test(value[caret - 2]))
    ) {
      setSlash({ blockId: block.id, start: caret - 1, query: '', index: 0 });
    }
  };

  const onTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) => {
    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const text = block.text;
    const indent = block.indent ?? 0;

    if (slash && slash.blockId === block.id) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = slashMatches.length || 1;
        setSlash({ ...slash, index: (slash.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const kind = slashMatches[slash.index];
        if (kind) applySlash(kind);
        else setSlash(null);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }

    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && block.type === 'todo') {
      e.preventDefault();
      update(block.id, { checked: !block.checked });
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      const isList = LIST_TYPES.includes(block.type);
      if (isList && text === '') {
        if (indent > 0) update(block.id, { indent: indent - 1 });
        else turnInto(block.id, 'paragraph');
        return;
      }
      const nextType: BlockType = isList ? block.type : 'paragraph';
      if (start === 0 && text !== '') {
        insertAt(index, { ...newBlock(nextType), indent: block.indent });
        focusBlock(block.id, 'start');
        return;
      }
      const after = text.slice(end);
      // Enter at the end of an open toggle's title moves into its body.
      if (block.type === 'toggle' && block.open && after === '') {
        focusBlock(block.id, 'start', 'body');
        return;
      }
      commit(
        blocksRef.current.map((b) => (b.id === block.id ? { ...b, text: text.slice(0, start) } : b)),
      );
      const nb: Block = {
        ...newBlock(nextType, after),
        indent: INDENTABLE.includes(nextType) ? block.indent : undefined,
      };
      insertAt(index + 1, nb);
      focusBlock(nb.id, 'start');
      return;
    }

    if (e.key === 'Backspace' && start === 0 && end === 0) {
      if (indent > 0) {
        e.preventDefault();
        update(block.id, { indent: indent - 1 });
        return;
      }
      if (block.type !== 'paragraph') {
        e.preventDefault();
        turnInto(block.id, 'paragraph');
        focusBlock(block.id, 'start');
        return;
      }
      const prev = blocksRef.current[index - 1];
      if (!prev) {
        if (text === '' && blocksRef.current.length > 1) {
          e.preventDefault();
          remove(block.id);
          const next = blocksRef.current[0];
          if (next && isTextual(next.type)) focusBlock(next.id, 'start');
        }
        return;
      }
      e.preventDefault();
      if (isTextual(prev.type)) {
        const field = prev.type === 'toggle' && prev.open ? 'body' : 'text';
        const prevText = field === 'body' ? (prev.body ?? '') : prev.text;
        commit(
          blocksRef.current
            .filter((b) => b.id !== block.id)
            .map((b) => (b.id === prev.id ? { ...b, [field]: prevText + text } : b)),
        );
        focusBlock(prev.id, prevText.length, field);
      } else if (text === '') {
        remove(block.id);
        const t = textualNeighbor(index, -1);
        if (t) focusBlock(t.id, 'end');
      } else {
        // Backspace into a table/image/divider removes that block, like Notion's select-then-delete.
        remove(prev.id);
        focusBlock(block.id, 'start');
      }
      return;
    }

    if (e.key === 'Tab' && block.type !== 'code') {
      e.preventDefault();
      if (!INDENTABLE.includes(block.type)) return;
      const next = e.shiftKey ? Math.max(0, indent - 1) : Math.min(4, indent + 1);
      update(block.id, { indent: next });
      return;
    }

    if (e.key === 'ArrowUp' && start === 0 && end === 0) {
      const prev = textualNeighbor(index, -1);
      e.preventDefault();
      if (prev) focusBlock(prev.id, 'end', prev.type === 'toggle' && prev.open ? 'body' : 'text');
      else onExitTop?.();
      return;
    }

    if (e.key === 'ArrowDown' && start === text.length && end === text.length) {
      if (block.type === 'toggle' && block.open) {
        e.preventDefault();
        focusBlock(block.id, 'start', 'body');
        return;
      }
      const next = textualNeighbor(index, 1);
      if (next) {
        e.preventDefault();
        focusBlock(next.id, 'start');
      }
    }
  };

  const onCodeKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) => {
    const el = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = el;
      update(block.id, { text: block.text.slice(0, s) + '  ' + block.text.slice(en) });
      focusBlock(block.id, s + 2);
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      addBlockAfter(index, 'paragraph');
      return;
    }
    onTextKeyDown(e, block, index);
  };

  const onBodyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) => {
    const el = e.currentTarget;
    const body = block.body ?? '';
    if ((e.key === 'Backspace' || e.key === 'ArrowUp') && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      focusBlock(block.id, 'end');
      return;
    }
    if (e.key === 'ArrowDown' && el.selectionStart === body.length) {
      const next = textualNeighbor(index, 1);
      if (next) {
        e.preventDefault();
        focusBlock(next.id, 'start');
      }
      return;
    }
    // Enter on an empty last line leaves the toggle.
    if (e.key === 'Enter' && !e.shiftKey && (body === '' || body.endsWith('\n')) && el.selectionStart === body.length) {
      e.preventDefault();
      update(block.id, { body: body.replace(/\n$/, '') });
      addBlockAfter(index, 'paragraph');
    }
  };

  // ---------- rendering ----------

  const renderContent = (block: Block, index: number) => {
    const placeholder =
      block.type === 'paragraph'
        ? focusedId === block.id
          ? "Type '/' for blocks, or just start writing"
          : ''
        : PLACEHOLDERS[block.type];

    const textArea = (className = 'block-text') => (
      <AutoTextarea
        data-field="text"
        className={className}
        value={block.text}
        placeholder={placeholder}
        onChange={(e) => onTextChange(block, e.currentTarget)}
        onKeyDown={(e) =>
          block.type === 'code' ? onCodeKeyDown(e, block, index) : onTextKeyDown(e, block, index)
        }
        onFocus={() => setFocusedId(block.id)}
        onBlur={() => setFocusedId((f) => (f === block.id ? null : f))}
        spellCheck={block.type !== 'code'}
      />
    );

    switch (block.type) {
      case 'paragraph':
        return textArea();
      case 'h1':
      case 'h2':
      case 'h3':
        return textArea(`block-text ${block.type}`);
      case 'bulleted':
        return (
          <div className="list-row">
            <span className="list-marker bullet">{['•', '◦', '▪'][(block.indent ?? 0) % 3]}</span>
            {textArea()}
          </div>
        );
      case 'numbered':
        return (
          <div className="list-row">
            <span className="list-marker number">{listNumber(blocks, index)}.</span>
            {textArea()}
          </div>
        );
      case 'todo':
        return (
          <div className={`list-row todo ${block.checked ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="todo-check"
              checked={!!block.checked}
              onChange={() => update(block.id, { checked: !block.checked })}
            />
            {textArea()}
          </div>
        );
      case 'toggle':
        return (
          <div className="toggle-block">
            <div className="list-row">
              <button
                className={`toggle-arrow ${block.open ? 'open' : ''}`}
                onClick={() => update(block.id, { open: !block.open })}
                aria-label={block.open ? 'Collapse' : 'Expand'}
              >
                ▶
              </button>
              {textArea('block-text toggle-title')}
            </div>
            {block.open && (
              <AutoTextarea
                data-field="body"
                className="block-text toggle-body"
                value={block.body ?? ''}
                placeholder="Empty toggle. Write something inside."
                onChange={(e) => update(block.id, { body: e.target.value })}
                onKeyDown={(e) => onBodyKeyDown(e, block, index)}
              />
            )}
          </div>
        );
      case 'quote':
        return <div className="quote-block">{textArea()}</div>;
      case 'callout':
        return <CalloutBlock block={block} onEmoji={(emoji) => update(block.id, { emoji })} text={textArea()} />;
      case 'code':
        return <div className="code-block">{textArea('block-text code')}</div>;
      case 'divider':
        return (
          <div className="divider-block">
            <hr />
          </div>
        );
      case 'table':
        return (
          <TableBlock
            blockId={block.id}
            table={block.table ?? { header: true, rows: [['']] }}
            onChange={(table) => update(block.id, { table })}
            onExit={() => addBlockAfter(index, 'paragraph')}
          />
        );
      case 'image':
        return (
          <ImageBlock
            image={block.image ?? { src: '', caption: '' }}
            onChange={(image) => update(block.id, { image })}
            onRemove={() => remove(block.id)}
          />
        );
    }
  };

  const appendOrFocusEnd = () => {
    const last = blocksRef.current[blocksRef.current.length - 1];
    if (last && last.type === 'paragraph' && last.text === '') focusBlock(last.id, 'start');
    else addBlockAfter(blocksRef.current.length - 1, 'paragraph');
  };

  return (
    <div
      ref={rootRef}
      className="editor"
      onDragOver={(e) => {
        if (dragId) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragId && drop) moveBlock(dragId, drop.id, drop.before);
        setDragId(null);
        setDrop(null);
      }}
    >
      {blocks.map((block, index) => (
        <BlockRow
          key={block.id}
          block={block}
          dragging={dragId === block.id}
          dropSide={drop?.id === block.id ? (drop.before ? 'before' : 'after') : null}
          onDragStart={() => setDragId(block.id)}
          onDragEnd={() => {
            setDragId(null);
            setDrop(null);
          }}
          onDragOverRow={(before) => dragId && setDrop({ id: block.id, before })}
          onAdd={() => {
            const b = newBlock('paragraph', '/');
            insertAt(index + 1, b);
            focusBlock(b.id, 'end');
            setSlash({ blockId: b.id, start: 0, query: '', index: 0 });
          }}
          kinds={BLOCK_KINDS.filter((k) => k.type !== block.type)}
          onTurnInto={(type) => turnInto(block.id, type)}
          onDuplicate={() => {
            const copy = { ...structuredClone(block), id: uid() };
            insertAt(index + 1, copy);
          }}
          onMove={(dir) => {
            const target = blocks[index + dir];
            if (target) moveBlock(block.id, target.id, dir === -1);
          }}
          onDelete={() => {
            remove(block.id);
            const t = textualNeighbor(index, -1) ?? textualNeighbor(index - 1, 1);
            if (t) focusBlock(t.id, 'end');
          }}
          canMoveUp={index > 0}
          canMoveDown={index < blocks.length - 1}
        >
          {renderContent(block, index)}
        </BlockRow>
      ))}

      <div className="editor-tail" onClick={appendOrFocusEnd}>
        {blocks.length === 0 && <span className="muted">Click to start writing, or type “/” for blocks…</span>}
      </div>

      {slash && (
        <SlashMenu
          blockId={slash.blockId}
          rootRef={rootRef}
          matches={slashMatches}
          index={slash.index}
          onHover={(i) => setSlash({ ...slash, index: i })}
          onPick={applySlash}
          onClose={() => setSlash(null)}
        />
      )}
    </div>
  );
}

// ---------- block row with gutter, menu, and drag handle ----------

interface BlockRowProps {
  block: Block;
  children: React.ReactNode;
  dragging: boolean;
  dropSide: 'before' | 'after' | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverRow: (before: boolean) => void;
  onAdd: () => void;
  kinds: BlockKind[];
  onTurnInto: (type: BlockType) => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function BlockRow(props: BlockRowProps) {
  const { block } = props;
  const menu = usePopover();
  const [armed, setArmed] = useState(false);
  const indent = block.indent ?? 0;

  useEffect(() => {
    if (!armed) return;
    const off = () => setArmed(false);
    window.addEventListener('mouseup', off);
    return () => window.removeEventListener('mouseup', off);
  }, [armed]);

  return (
    <div
      data-block-id={block.id}
      className={`block block-${block.type} ${props.dragging ? 'dragging' : ''} ${
        props.dropSide ? `drop-${props.dropSide}` : ''
      } ${menu.anchor ? 'menu-open' : ''}`}
      style={indent ? { paddingLeft: indent * 24 } : undefined}
      draggable={armed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', block.id);
        props.onDragStart();
      }}
      onDragEnd={() => {
        setArmed(false);
        props.onDragEnd();
      }}
      onDragOver={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        props.onDragOverRow(e.clientY < r.top + r.height / 2);
      }}
    >
      <div className="gutter" style={indent ? { left: indent * 24 - 48 } : undefined}>
        <button className="gutter-btn" title="Add a block below" onClick={props.onAdd} tabIndex={-1}>
          <PlusIcon />
        </button>
        <button
          className="gutter-btn grip"
          title="Drag to move · Click for options"
          onMouseDown={() => setArmed(true)}
          onClick={(e) => menu.toggle(e.currentTarget)}
          tabIndex={-1}
        >
          <GripIcon />
        </button>
      </div>
      <div className="block-content">{props.children}</div>

      {menu.anchor && (
        <Popover anchor={menu.anchor} onClose={menu.close}>
          <div className="block-menu">
            <Menu
              onClose={menu.close}
              items={[
                { label: 'Duplicate', icon: <CopyIcon />, onClick: props.onDuplicate },
                ...(props.canMoveUp
                  ? [{ label: 'Move up', icon: <ArrowUpIcon />, onClick: () => props.onMove(-1) }]
                  : []),
                ...(props.canMoveDown
                  ? [{ label: 'Move down', icon: <ArrowDownIcon />, onClick: () => props.onMove(1) }]
                  : []),
                { label: 'Delete', icon: <TrashIcon />, danger: true, onClick: props.onDelete },
              ]}
            />
            <div className="menu-sep" />
            <div className="menu-heading">Turn into</div>
            <div className="menu turn-into">
              {props.kinds.map((kind) => (
                <button
                  key={kind.type}
                  className="menu-item"
                  onClick={() => {
                    menu.close();
                    props.onTurnInto(kind.type);
                  }}
                >
                  <span className="kind-glyph small">{kind.glyph}</span>
                  <span className="menu-label">{kind.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Popover>
      )}
    </div>
  );
}

// ---------- slash menu ----------

function SlashMenu(props: {
  blockId: string;
  rootRef: React.RefObject<HTMLDivElement | null>;
  matches: BlockKind[];
  index: number;
  onHover: (i: number) => void;
  onPick: (k: BlockKind) => void;
  onClose: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setAnchor(
      props.rootRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${props.blockId}"] [data-field="text"]`,
      ) ?? null,
    );
  }, [props.blockId, props.rootRef]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${props.index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [props.index]);

  if (!anchor) return null;
  return (
    <Popover anchor={anchor} onClose={props.onClose} passive>
      <div className="slash-menu" ref={listRef}>
        <div className="menu-heading">Blocks</div>
        {props.matches.length === 0 && <div className="menu-empty">No results</div>}
        {props.matches.map((k, i) => (
          <button
            key={k.type}
            data-index={i}
            className={`slash-item ${i === props.index ? 'active' : ''}`}
            onMouseEnter={() => props.onHover(i)}
            onClick={() => props.onPick(k)}
          >
            <span className="kind-glyph">{k.glyph}</span>
            <span>
              <span className="slash-label">{k.label}</span>
              <span className="slash-desc">{k.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}

// ---------- special blocks ----------

function CalloutBlock({
  block,
  onEmoji,
  text,
}: {
  block: Block;
  onEmoji: (e: string) => void;
  text: React.ReactNode;
}) {
  const pop = usePopover();
  return (
    <div className="callout-block">
      <button className="callout-emoji" onClick={(e) => pop.toggle(e.currentTarget)}>
        {block.emoji || '💡'}
      </button>
      {text}
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close}>
          <EmojiPicker
            onPick={(e) => {
              onEmoji(e);
              pop.close();
            }}
          />
        </Popover>
      )}
    </div>
  );
}

function TableBlock({
  blockId,
  table,
  onChange,
  onExit,
}: {
  blockId: string;
  table: { header: boolean; rows: string[][] };
  onChange: (t: { header: boolean; rows: string[][] }) => void;
  onExit: () => void;
}) {
  const { rows } = table;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const wrapRef = useRef<HTMLDivElement>(null);
  const pendingCell = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!pendingCell.current) return;
    wrapRef.current?.querySelector<HTMLTextAreaElement>(`[data-field="${pendingCell.current}"]`)?.focus();
    pendingCell.current = null;
  });

  const setRows = (next: string[][]) => onChange({ ...table, rows: next });
  const setCell = (r: number, c: number, v: string) =>
    setRows(rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)));
  const addRow = (at = rows.length) => {
    const next = [...rows];
    next.splice(at, 0, Array(cols).fill(''));
    setRows(next);
  };
  const addCol = () => setRows(rows.map((r) => [...r, '']));
  const delRow = (r: number) => (rows.length > 1 ? setRows(rows.filter((_, i) => i !== r)) : undefined);
  const delCol = (c: number) => (cols > 1 ? setRows(rows.map((row) => row.filter((_, i) => i !== c))) : undefined);

  const onCellKey = (e: KeyboardEvent<HTMLTextAreaElement>, r: number, c: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (r === rows.length - 1) addRow();
      pendingCell.current = `cell-${r + 1}-${c}`;
      if (r < rows.length - 1) {
        wrapRef.current?.querySelector<HTMLTextAreaElement>(`[data-field="${pendingCell.current}"]`)?.focus();
        pendingCell.current = null;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onExit();
    }
  };

  return (
    <div className="table-block" ref={wrapRef} data-table={blockId}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr className="col-tools">
              {Array.from({ length: cols }, (_, c) => (
                <th key={c}>
                  {cols > 1 && (
                    <button className="tool-btn" tabIndex={-1} title="Delete column" onClick={() => delCol(c)}>
                      <CloseIcon width={10} height={10} />
                    </button>
                  )}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={table.header && r === 0 ? 'header-row' : ''}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c}>
                    <AutoTextarea
                      data-field={`cell-${r}-${c}`}
                      className="cell-input"
                      value={row[c] ?? ''}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onKeyDown={(e) => onCellKey(e, r, c)}
                    />
                  </td>
                ))}
                <td className="row-tools">
                  {rows.length > 1 && (
                    <button className="tool-btn" tabIndex={-1} title="Delete row" onClick={() => delRow(r)}>
                      <CloseIcon width={10} height={10} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-col" onClick={addCol} title="Add a column" tabIndex={-1}>
          <PlusIcon />
        </button>
      </div>
      <div className="table-foot">
        <button className="ghost-btn" onClick={() => addRow()} tabIndex={-1}>
          <PlusIcon /> New row
        </button>
        <label className="ghost-btn">
          <input
            type="checkbox"
            checked={table.header}
            onChange={() => onChange({ ...table, header: !table.header })}
          />
          Header row
        </label>
      </div>
    </div>
  );
}

function ImageBlock({
  image,
  onChange,
  onRemove,
}: {
  image: { src: string; caption: string };
  onChange: (img: { src: string; caption: string }) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange({ ...image, src: await imageFileToDataUrl(file) });
    } catch {
      setError('Could not read that image.');
    } finally {
      setBusy(false);
    }
  };

  if (!image.src) {
    return (
      <div
        className="image-empty"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          e.stopPropagation();
          void upload(e.dataTransfer.files[0]);
        }}
      >
        <ImageIcon />
        <button className="btn" disabled={busy} onClick={async () => upload(await pickImageFile())}>
          <UploadIcon /> {busy ? 'Processing…' : 'Upload'}
        </button>
        <form
          className="link-form inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) onChange({ ...image, src: url.trim() });
          }}
        >
          <input
            className="input"
            placeholder="…or paste an image link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn" type="submit">
            Embed
          </button>
        </form>
        {error && <span className="error small">{error}</span>}
      </div>
    );
  }

  return (
    <figure className="image-block">
      <img src={image.src} alt={image.caption} />
      <div className="image-tools">
        <button className="btn small" onClick={() => onChange({ ...image, src: '' })}>
          Replace
        </button>
        <button className="btn small" onClick={onRemove}>
          <TrashIcon />
        </button>
      </div>
      <input
        className="caption"
        placeholder="Add a caption…"
        value={image.caption}
        onChange={(e) => onChange({ ...image, caption: e.target.value })}
      />
    </figure>
  );
}

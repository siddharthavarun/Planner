import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CalcKind, ColumnSpec, ColumnType, TableData } from '../types';
import { colLetter, evaluate, parseNumber } from '../formula';
import { formatDate } from '../utils';
import { AutoTextarea } from './AutoTextarea';
import { CheckIcon, CloseIcon, DotsIcon, PlusIcon, TrashIcon } from './Icons';
import { Popover, type Anchor } from './Popover';

const TYPES: { type: ColumnType; label: string; glyph: string }[] = [
  { type: 'text', label: 'Text', glyph: 'Aa' },
  { type: 'number', label: 'Number', glyph: '#' },
  { type: 'currency', label: 'Currency', glyph: '¤' },
  { type: 'percent', label: 'Percent', glyph: '%' },
  { type: 'date', label: 'Date', glyph: '◷' },
  { type: 'checkbox', label: 'Checkbox', glyph: '☑' },
];

const CALCS: { calc: CalcKind; label: string }[] = [
  { calc: 'none', label: 'None' },
  { calc: 'sum', label: 'Sum' },
  { calc: 'avg', label: 'Average' },
  { calc: 'min', label: 'Min' },
  { calc: 'max', label: 'Max' },
  { calc: 'count', label: 'Count' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF'];

/** A sensible default currency for the viewer's region. */
function defaultCurrency(): string {
  const region = (navigator.language.split('-')[1] ?? '').toUpperCase();
  const map: Record<string, string> = { US: 'USD', GB: 'GBP', IN: 'INR', JP: 'JPY', AU: 'AUD', CA: 'CAD', CH: 'CHF' };
  const euro = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'HR', 'MT', 'CY'];
  return map[region] ?? (euro.includes(region) ? 'EUR' : 'USD');
}

const isNumeric = (t: ColumnType) => t === 'number' || t === 'currency' || t === 'percent';

function format(value: number, spec: ColumnSpec): string {
  switch (spec.type) {
    case 'currency':
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: spec.currency ?? 'USD' }).format(value);
    case 'percent':
      return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(value);
    default:
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value);
  }
}

type Result = { ok: true; value: number | null } | { ok: false; error: string };

export function TableBlock({
  blockId,
  table,
  onChange,
  onExit,
  onDelete,
}: {
  blockId: string;
  table: TableData;
  onChange: (t: TableData) => void;
  onExit: () => void;
  onDelete: () => void;
}) {
  const { rows } = table;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const specs: ColumnSpec[] = Array.from({ length: cols }, (_, c) => table.columns?.[c] ?? { type: 'text' });
  const first = table.header ? 1 : 0;
  const dataRows = rows.slice(first);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pendingCell = useRef<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ col: number; anchor: Anchor; part: 'column' | 'calc' } | null>(null);

  useLayoutEffect(() => {
    if (!pendingCell.current) return;
    wrapRef.current?.querySelector<HTMLTextAreaElement>(`[data-field="${pendingCell.current}"]`)?.focus();
    pendingCell.current = null;
  });

  // ---------- values & formulas ----------

  // References count data rows only: with a header row, A1 is the first row under it.
  const results = new Map<string, Result>();
  const compute = (c: number, r: number, stack: Set<string>): Result => {
    const key = `${c}:${r}`;
    const cached = results.get(key);
    if (cached) return cached;
    if (stack.has(key)) return { ok: false, error: 'Refers to itself' };
    const raw = (dataRows[r]?.[c] ?? '').trim();
    const spec = specs[c] ?? { type: 'text' };
    let res: Result;
    if (raw.startsWith('=')) {
      stack.add(key);
      try {
        const v = evaluate(
          raw.slice(1),
          (cc, rr) => {
            if (cc < 0 || cc >= cols || rr < 0 || rr >= dataRows.length) throw new Error('No such cell');
            const inner = compute(cc, rr, stack);
            if (!inner.ok) throw new Error(inner.error);
            return inner.value ?? 0;
          },
          dataRows.length,
        );
        res = { ok: true, value: v };
      } catch (err) {
        res = { ok: false, error: err instanceof Error ? err.message : 'Error' };
      }
      stack.delete(key);
    } else if (spec.type === 'checkbox') {
      res = { ok: true, value: raw === '1' ? 1 : 0 };
    } else if (spec.type === 'percent') {
      const n = parseNumber(raw.replace(/%$/, ''));
      res = { ok: true, value: n === null ? null : n / 100 };
    } else {
      res = { ok: true, value: parseNumber(raw) };
    }
    results.set(key, res);
    return res;
  };
  const valueAt = (c: number, r: number) => compute(c, r, new Set());

  const calcFor = (c: number): string | null => {
    const kind = specs[c].calc ?? 'none';
    if (kind === 'none') return null;
    if (kind === 'count') {
      const n = dataRows.filter((row) => (row[c] ?? '').trim() !== '' && (specs[c].type !== 'checkbox' || row[c] === '1')).length;
      return String(n);
    }
    const nums = dataRows
      .map((_, r) => valueAt(c, r))
      .filter((x): x is { ok: true; value: number } => x.ok && x.value !== null)
      .map((x) => x.value);
    if (nums.length === 0) return '—';
    const v =
      kind === 'sum'
        ? nums.reduce((a, b) => a + b, 0)
        : kind === 'avg'
          ? nums.reduce((a, b) => a + b, 0) / nums.length
          : kind === 'min'
            ? Math.min(...nums)
            : Math.max(...nums);
    return format(v, specs[c].type === 'text' || specs[c].type === 'date' || specs[c].type === 'checkbox' ? { type: 'number' } : specs[c]);
  };

  // ---------- edits ----------

  const commit = (nextRows: string[][], nextSpecs: ColumnSpec[] = specs) =>
    onChange({ ...table, rows: nextRows, columns: nextSpecs });
  const setCell = (r: number, c: number, v: string) =>
    commit(rows.map((row, ri) => (ri === r ? Array.from({ length: cols }, (_, ci) => (ci === c ? v : (row[ci] ?? ''))) : row)));
  const setSpec = (c: number, patch: Partial<ColumnSpec>) =>
    commit(rows, specs.map((s, i) => (i === c ? { ...s, ...patch } : s)));
  const addRow = (at = rows.length) => {
    const next = [...rows];
    next.splice(at, 0, Array(cols).fill(''));
    commit(next);
  };
  const insertCol = (at: number) =>
    commit(
      rows.map((r) => {
        const n = Array.from({ length: cols }, (_, i) => r[i] ?? '');
        n.splice(at, 0, '');
        return n;
      }),
      [...specs.slice(0, at), { type: 'text' }, ...specs.slice(at)],
    );
  const delRow = (r: number) => rows.length > 1 && commit(rows.filter((_, i) => i !== r));
  const delCol = (c: number) =>
    cols > 1 &&
    commit(
      rows.map((row) => row.filter((_, i) => i !== c)),
      specs.filter((_, i) => i !== c),
    );

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

  // Letters and row numbers only matter once there are numbers or formulas to refer to.
  const showRefs = specs.some((s) => s.type !== 'text') || dataRows.some((row) => row.some((v) => v.trim().startsWith('=')));

  const renderCell = (r: number, c: number) => {
    const raw = rows[r]?.[c] ?? '';
    const spec = specs[c];
    const field = `cell-${r}-${c}`;
    const isHeader = table.header && r === 0;

    if (!isHeader && spec.type === 'checkbox') {
      return (
        <div className="cell-check">
          <input
            type="checkbox"
            className="todo-check"
            checked={raw === '1'}
            onChange={() => setCell(r, c, raw === '1' ? '' : '1')}
            aria-label={`Row ${r + 1 - first}`}
          />
        </div>
      );
    }
    if (!isHeader && spec.type === 'date') {
      return (
        <label className="cell-date">
          <span className={raw ? '' : 'muted'}>{raw ? formatDate(raw) : 'Pick a date'}</span>
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''}
            onChange={(e) => setCell(r, c, e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {
                // Older browsers open the picker on their own.
              }
            }}
          />
        </label>
      );
    }

    let shown = raw;
    let error: string | null = null;
    const numericLike = !isHeader && (isNumeric(spec.type) || raw.trim().startsWith('='));
    if (numericLike && focused !== field && raw.trim() !== '') {
      const res = valueAt(c, r - first);
      if (!res.ok) {
        error = res.error;
        shown = '⚠ Error';
      } else if (res.value !== null) {
        shown = format(res.value, spec.type === 'text' ? { type: 'number' } : spec);
      }
    }
    return (
      <AutoTextarea
        data-field={field}
        className={`cell-input ${numericLike ? 'num' : ''} ${error ? 'cell-error' : ''}`}
        title={error ?? undefined}
        value={shown}
        placeholder={!isHeader && isNumeric(spec.type) && focused === field ? '0 or =formula' : undefined}
        onFocus={() => setFocused(field)}
        onBlur={() => setFocused((f) => (f === field ? null : f))}
        onChange={(e) => setCell(r, c, e.target.value)}
        onKeyDown={(e) => onCellKey(e, r, c)}
        inputMode="text"
      />
    );
  };

  const menuSpec = menu ? specs[menu.col] : null;

  return (
    <div className="table-block" ref={wrapRef} data-table={blockId}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr className="col-tools">
              {showRefs && <th className="ref-col" />}
              {specs.map((spec, c) => (
                <th key={c}>
                  <button
                    className="col-btn"
                    tabIndex={-1}
                    onClick={(e) => setMenu({ col: c, anchor: e.currentTarget, part: 'column' })}
                    title="Column type and options"
                  >
                    {showRefs && <span className="col-letter">{colLetter(c)}</span>}
                    <span className="col-type">{TYPES.find((t) => t.type === spec.type)?.label}</span>
                    <DotsIcon width={12} height={12} />
                  </button>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((_, r) => (
              <tr key={r} className={table.header && r === 0 ? 'header-row' : ''}>
                {showRefs && <td className="ref-col">{r >= first ? r - first + 1 : ''}</td>}
                {specs.map((spec, c) => (
                  <td key={c} className={`type-${spec.type}`}>
                    {renderCell(r, c)}
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
            <tr className="calc-row">
              {showRefs && <td className="ref-col" />}
              {specs.map((spec, c) => {
                const v = calcFor(c);
                const kind = CALCS.find((k) => k.calc === (spec.calc ?? 'none'))!;
                return (
                  <td key={c}>
                    <button
                      className={`calc-btn ${v === null ? 'empty' : ''}`}
                      tabIndex={-1}
                      onClick={(e) => setMenu({ col: c, anchor: e.currentTarget, part: 'calc' })}
                    >
                      {v === null ? (
                        'Calculate'
                      ) : (
                        <>
                          <span className="calc-kind">{kind.label}</span> {v}
                        </>
                      )}
                    </button>
                  </td>
                );
              })}
              <td className="row-tools" />
            </tr>
          </tbody>
        </table>
        <button className="add-col" onClick={() => insertCol(cols)} title="Add a column" tabIndex={-1}>
          <PlusIcon />
        </button>
      </div>
      <div className="table-foot">
        <button className="ghost-btn" onClick={() => addRow()} tabIndex={-1}>
          <PlusIcon /> New row
        </button>
        <label className="ghost-btn">
          <input type="checkbox" checked={table.header} onChange={() => onChange({ ...table, header: !table.header })} />
          Header row
        </label>
        <span className="spacer" />
        <button className="ghost-btn danger-text" onClick={onDelete} tabIndex={-1}>
          <TrashIcon /> Delete table
        </button>
      </div>
      {showRefs && (
        <p className="table-hint">
          Type <code>=</code> for a formula, e.g. <code>=B1*12</code>, <code>=SUM(B)</code> or <code>=AVG(B1:B4)</code>.
        </p>
      )}

      {menu && menuSpec && (
        <Popover anchor={menu.anchor} onClose={() => setMenu(null)}>
          <div className="option-list col-menu">
            {menu.part === 'column' && (
              <>
                <div className="menu-heading">Column {colLetter(menu.col)} type</div>
                {TYPES.map((t) => (
                  <button
                    key={t.type}
                    className="option"
                    onClick={() =>
                      setSpec(menu.col, {
                        type: t.type,
                        currency: t.type === 'currency' ? (menuSpec.currency ?? defaultCurrency()) : menuSpec.currency,
                        calc: isNumeric(t.type) && !menuSpec.calc ? 'sum' : menuSpec.calc,
                      })
                    }
                  >
                    <span className="kind-glyph small">{t.glyph}</span>
                    <span className="menu-label">{t.label}</span>
                    {menuSpec.type === t.type && <CheckIcon />}
                  </button>
                ))}
                {menuSpec.type === 'currency' && (
                  <div className="currency-row">
                    {CURRENCIES.map((cur) => (
                      <button
                        key={cur}
                        className={`chip-btn ${menuSpec.currency === cur ? 'on' : ''}`}
                        onClick={() => setSpec(menu.col, { currency: cur })}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                )}
                <div className="menu-sep" />
              </>
            )}
            <div className="menu-heading">Calculate</div>
            {CALCS.map((k) => (
              <button
                key={k.calc}
                className="option"
                onClick={() => {
                  setSpec(menu.col, { calc: k.calc });
                  if (menu.part === 'calc') setMenu(null);
                }}
              >
                <span className="menu-label">{k.label}</span>
                {(menuSpec.calc ?? 'none') === k.calc && <CheckIcon />}
              </button>
            ))}
            {menu.part === 'column' && (
              <>
                <div className="menu-sep" />
                <button
                  className="option"
                  onClick={() => {
                    insertCol(menu.col);
                    setMenu(null);
                  }}
                >
                  Insert column left
                </button>
                <button
                  className="option"
                  onClick={() => {
                    insertCol(menu.col + 1);
                    setMenu(null);
                  }}
                >
                  Insert column right
                </button>
                {cols > 1 && (
                  <button
                    className="option danger-text"
                    onClick={() => {
                      delCol(menu.col);
                      setMenu(null);
                    }}
                  >
                    <TrashIcon /> Delete column
                  </button>
                )}
              </>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}

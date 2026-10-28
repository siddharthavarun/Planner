import { useState } from 'react';
import type { CalcKind, ColumnSpec, ReportData, ReportItem, ReportKind } from '../types';
import { uid } from '../utils';
import {
  columnName,
  columnSpecs,
  dataRows,
  defaultCurrency,
  formatValue,
  isNumeric,
  useWorkbook,
  type Workbook,
} from '../workbook';
import { colLetter } from '../formula';
import { BarChart, DonutChart, LineChart, SERIES_COLORS, type Series } from './Charts';
import { ArrowDownIcon, ArrowUpIcon, DotsIcon, PlusIcon, TrashIcon } from './Icons';
import { Menu, Popover, usePopover, type Anchor } from './Popover';

const KINDS: { kind: ReportKind; label: string; glyph: string; desc: string }[] = [
  { kind: 'number', label: 'Number', glyph: '123', desc: 'A headline figure, e.g. total spent' },
  { kind: 'bar', label: 'Bar chart', glyph: '▤', desc: 'Compare rows, e.g. spend per item' },
  { kind: 'line', label: 'Line chart', glyph: '⟋', desc: 'A trend across rows, e.g. by month' },
  { kind: 'donut', label: 'Donut chart', glyph: '◔', desc: 'Each row’s share of the total' },
];

const CALC_LABEL: Record<CalcKind, string> = {
  none: 'None',
  sum: 'Sum',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
  count: 'Count',
};

/** Picks sensible defaults so a new item shows something straight away. */
function newItem(kind: ReportKind, wb: Workbook): ReportItem {
  const table = wb.tables.find((t) => columnSpecs(t.data).some((s) => isNumeric(s.type))) ?? wb.tables[0];
  const specs = table ? columnSpecs(table.data) : [];
  const numCol = Math.max(0, specs.findIndex((s) => isNumeric(s.type)));
  const textCol = specs.findIndex((s) => s.type === 'text');
  return {
    id: uid(),
    kind,
    title: '',
    tableId: table?.id,
    labelCol: textCol,
    valueCols: table ? [numCol] : [],
    calc: 'sum',
  };
}

export function ReportBlock({
  report,
  onChange,
  onDelete,
}: {
  report: ReportData;
  onChange: (r: ReportData) => void;
  onDelete: () => void;
}) {
  const wb = useWorkbook();
  const addMenu = usePopover();
  const [editing, setEditing] = useState<{ id: string; anchor: Anchor } | null>(null);
  const items = report.items;

  const setItem = (id: string, patch: Partial<ReportItem>) =>
    onChange({ items: items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const move = (id: string, dir: -1 | 1) => {
    const i = items.findIndex((it) => it.id === id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ items: next });
  };
  const editingItem = editing && items.find((it) => it.id === editing.id);

  return (
    <div className="report-block">
      <div className="report-bar">
        <span className="report-label">Report</span>
        <span className="report-live">● Live</span>
        <span className="spacer" />
        <button className="ghost-btn" onClick={(e) => addMenu.toggle(e.currentTarget)}>
          <PlusIcon /> Add
        </button>
        <button className="ghost-btn danger-text" onClick={onDelete}>
          <TrashIcon /> Delete report
        </button>
      </div>

      {items.length === 0 ? (
        <div className="report-empty">
          {wb.tables.length === 0
            ? 'Add a table with numbers anywhere in your planner, then add tiles and charts here. They update whenever the table changes.'
            : 'Add a number or a chart. It reads straight from your tables and updates whenever they change.'}
        </div>
      ) : (
        <div className="report-grid">
          {items.map((it) => (
            <ReportCard
              key={it.id}
              item={it}
              wb={wb}
              onEdit={(anchor) => setEditing({ id: it.id, anchor })}
              onMove={(dir) => move(it.id, dir)}
              onRemove={() => onChange({ items: items.filter((x) => x.id !== it.id) })}
            />
          ))}
        </div>
      )}

      {addMenu.anchor && (
        <Popover anchor={addMenu.anchor} onClose={addMenu.close} align="end">
          <div className="slash-menu static">
            <div className="menu-heading">Add to report</div>
            {KINDS.map((k) => (
              <button
                key={k.kind}
                className="slash-item"
                onClick={() => {
                  const item = newItem(k.kind, wb);
                  onChange({ items: [...items, item] });
                  setEditing({ id: item.id, anchor: addMenu.anchor! });
                  addMenu.close();
                }}
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
      )}

      {editing && editingItem && (
        <Popover anchor={editing.anchor} onClose={() => setEditing(null)}>
          <ItemEditor item={editingItem} wb={wb} onChange={(patch) => setItem(editingItem.id, patch)} onDone={() => setEditing(null)} />
        </Popover>
      )}
    </div>
  );
}

// ---------- one tile or chart ----------

function ReportCard({
  item,
  wb,
  onEdit,
  onMove,
  onRemove,
}: {
  item: ReportItem;
  wb: Workbook;
  onEdit: (a: Anchor) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const menu = usePopover();
  const [showData, setShowData] = useState(false);
  const table = wb.table(item.tableId);
  const isChart = item.kind !== 'number';

  let body: React.ReactNode;
  let subtitle = '';
  let dataView: { labels: string[]; series: Series[]; format: (n: number) => string } | null = null;

  if (item.kind === 'number') {
    const r = numberValue(item, wb);
    subtitle = r.subtitle;
    body = (
      <>
        <div className={`tile-value ${r.error ? 'error' : ''}`} title={r.error ?? undefined}>
          {r.error ? '⚠ Error' : r.text}
        </div>
        {r.error && <div className="tile-error">{r.error}</div>}
        {r.target !== null && r.value !== null && (
          <div className="tile-target">
            <div className="progress-track">
              <div
                className={`progress-fill ${r.value >= r.target ? 'done' : ''}`}
                style={{ width: `${Math.max(0, Math.min(100, (r.value / r.target) * 100))}%` }}
              />
            </div>
            <span>
              {Math.round((r.value / r.target) * 100)}% of {r.format(r.target)}
            </span>
          </div>
        )}
      </>
    );
  } else if (!table) {
    body = <p className="chart-empty">Choose a table in ⋯ › Edit.</p>;
  } else {
    const d = chartData(item, wb);
    dataView = d;
    subtitle = table.label;
    if (d.labels.length === 0 || d.series.length === 0) {
      body = <p className="chart-empty">No numbers to plot yet. Pick number columns in ⋯ › Edit.</p>;
    } else if (item.kind === 'bar') {
      body = <BarChart {...d} />;
    } else if (item.kind === 'line') {
      body = <LineChart {...d} />;
    } else {
      body = <DonutChart labels={d.labels} values={d.series[0].values} format={d.format} />;
    }
  }

  const title =
    item.title ||
    (item.kind === 'number'
      ? subtitle.split(' · ')[0] || 'Number'
      : table
        ? item.valueCols.map((c) => columnName(table.data, c)).join(', ') || KINDS.find((k) => k.kind === item.kind)!.label
        : KINDS.find((k) => k.kind === item.kind)!.label);

  return (
    <div className={`report-card ${isChart ? 'chart-card' : 'tile-card'}`}>
      <div className="report-card-head">
        <div className="report-card-titles">
          <div className="report-card-title">{title}</div>
          {subtitle && <div className="report-card-sub">{subtitle}</div>}
        </div>
        <button className="icon-btn small" onClick={(e) => menu.toggle(e.currentTarget)} aria-label="Options">
          <DotsIcon />
        </button>
      </div>
      {body}
      {isChart && dataView && dataView.labels.length > 0 && (
        <button className="show-data" onClick={() => setShowData(!showData)}>
          {showData ? 'Hide data' : 'Show data'}
        </button>
      )}
      {showData && dataView && (
        <table className="data-view">
          <thead>
            <tr>
              <th />
              {dataView.series.map((s) => (
                <th key={s.name}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataView.labels.map((l, i) => (
              <tr key={i}>
                <td>{l}</td>
                {dataView!.series.map((s) => (
                  <td key={s.name}>{s.values[i] === null ? '—' : dataView!.format(s.values[i]!)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {menu.anchor && (
        <Popover anchor={menu.anchor} onClose={menu.close} align="end">
          <Menu
            onClose={menu.close}
            items={[
              { label: 'Edit', onClick: () => onEdit(menu.anchor!) },
              { label: 'Move earlier', icon: <ArrowUpIcon />, onClick: () => onMove(-1) },
              { label: 'Move later', icon: <ArrowDownIcon />, onClick: () => onMove(1) },
              'sep',
              { label: 'Remove', icon: <TrashIcon />, danger: true, onClick: onRemove },
            ]}
          />
        </Popover>
      )}
    </div>
  );
}

function formatFor(item: ReportItem, wb: Workbook): ColumnSpec {
  if (item.formula !== undefined) {
    if (item.format === 'currency') return { type: 'currency', currency: item.currency ?? defaultCurrency() };
    if (item.format === 'percent') return { type: 'percent' };
    return { type: 'number' };
  }
  if (item.calc === 'count') return { type: 'number' };
  return wb.specOf(item.tableId, item.valueCols[0] ?? 0);
}

function numberValue(item: ReportItem, wb: Workbook) {
  const spec = formatFor(item, wb);
  const format = (n: number) => formatValue(n, spec);
  const table = wb.table(item.tableId);
  let value: number | null = null;
  let error: string | null = null;
  let subtitle = '';
  if (item.formula !== undefined) {
    const r = wb.formula(item.formula, item.tableId);
    if (r.ok) value = r.value;
    else error = r.error;
    subtitle = `=${item.formula.replace(/^=/, '')}`;
  } else if (table && item.valueCols.length) {
    const c = item.valueCols[0];
    value = wb.calc(table.id, c, item.calc ?? 'sum');
    subtitle = `${CALC_LABEL[item.calc ?? 'sum']} of ${columnName(table.data, c)} · ${table.name || table.label.split(' › ').slice(-2).join(' › ')}`;
  } else {
    error = 'Choose a table in ⋯ › Edit';
  }
  let target: number | null = null;
  if (item.target?.trim()) {
    const t = wb.formula(item.target, item.tableId);
    if (t.ok && t.value) target = t.value;
  }
  return { value, error, subtitle, target, format, text: value === null ? '—' : format(value) };
}

function chartData(item: ReportItem, wb: Workbook) {
  const table = wb.table(item.tableId)!;
  const rows = dataRows(table.data);
  const cols = item.kind === 'donut' ? item.valueCols.slice(0, 1) : item.valueCols.slice(0, 3);
  const labelsAll = rows.map((row, i) => {
    const l = item.labelCol !== undefined && item.labelCol >= 0 ? (row[item.labelCol] ?? '').trim() : '';
    return l || `Row ${i + 1}`;
  });
  const seriesAll: Series[] = cols.map((c, si) => ({
    name: columnName(table.data, c),
    color: SERIES_COLORS[si],
    values: rows.map((_, r) => {
      const v = wb.cell(table.id, c, r);
      return v.ok ? v.value : null;
    }),
  }));
  // Skip rows with no numbers at all (e.g. blank rows at the end).
  const keep = rows.map((_, r) => seriesAll.some((s) => s.values[r] !== null));
  const labels = labelsAll.filter((_, r) => keep[r]);
  const series = seriesAll.map((s) => ({ ...s, values: s.values.filter((_, r) => keep[r]) }));
  const spec = wb.specOf(table.id, cols[0] ?? 0);
  return {
    labels,
    series,
    format: (n: number) => formatValue(n, spec),
    compact: (n: number) => formatValue(n, spec, true),
  };
}

// ---------- editor ----------

function ItemEditor({
  item,
  wb,
  onChange,
  onDone,
}: {
  item: ReportItem;
  wb: Workbook;
  onChange: (patch: Partial<ReportItem>) => void;
  onDone: () => void;
}) {
  const table = wb.table(item.tableId);
  const specs = table ? columnSpecs(table.data) : [];
  const colOption = (c: number) => `${colLetter(c)} · ${columnName(table!.data, c)}`;
  const mode = item.formula !== undefined ? 'formula' : 'column';
  const maxSeries = item.kind === 'donut' ? 1 : 3;
  const namedTables = wb.tables.filter((t) => t.name);

  return (
    <div className="item-editor">
      <div className="menu-heading">{KINDS.find((k) => k.kind === item.kind)!.label}</div>
      <label className="field">
        <span>Title</span>
        <input className="input" value={item.title} placeholder="Automatic" onChange={(e) => onChange({ title: e.target.value })} />
      </label>

      {item.kind === 'number' && (
        <div className="seg wide" role="radiogroup">
          <button className={mode === 'column' ? 'on' : ''} onClick={() => onChange({ formula: undefined })}>
            From a column
          </button>
          <button className={mode === 'formula' ? 'on' : ''} onClick={() => onChange({ formula: item.formula ?? '' })}>
            Formula
          </button>
        </div>
      )}

      {(item.kind !== 'number' || mode === 'column') && (
        <label className="field">
          <span>Table</span>
          <select
            className="input"
            value={item.tableId ?? ''}
            onChange={(e) => {
              const t = wb.table(e.target.value);
              const s = t ? columnSpecs(t.data) : [];
              onChange({
                tableId: e.target.value,
                valueCols: [Math.max(0, s.findIndex((x) => isNumeric(x.type)))],
                labelCol: s.findIndex((x) => x.type === 'text'),
              });
            }}
          >
            {!table && <option value="">Choose a table…</option>}
            {wb.tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {wb.tables.length === 0 && <small className="muted">No tables yet. Add one with /table on any goal.</small>}
        </label>
      )}

      {item.kind === 'number' && mode === 'column' && table && (
        <div className="field-row">
          <label className="field">
            <span>Calculate</span>
            <select className="input" value={item.calc ?? 'sum'} onChange={(e) => onChange({ calc: e.target.value as CalcKind })}>
              {(['sum', 'avg', 'min', 'max', 'count'] as CalcKind[]).map((k) => (
                <option key={k} value={k}>
                  {CALC_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>of column</span>
            <select
              className="input"
              value={item.valueCols[0] ?? 0}
              onChange={(e) => onChange({ valueCols: [Number(e.target.value)] })}
            >
              {specs.map((_, c) => (
                <option key={c} value={c}>
                  {colOption(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {item.kind === 'number' && mode === 'formula' && (
        <>
          <label className="field">
            <span>Formula</span>
            <input
              className="input mono"
              value={item.formula ?? ''}
              placeholder="=SUM(Budget!B) - SUM(Spent!B)"
              onChange={(e) => onChange({ formula: e.target.value })}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <small className="muted">
              Use named tables: {namedTables.length ? namedTables.map((t) => t.name).join(', ') : 'name a table first'}. E.g.{' '}
              <code>Budget!B2</code>, <code>SUM(Budget!B)</code>, <code>AVG(Budget!B1:B6)</code>.
            </small>
          </label>
          <div className="field-row">
            <label className="field">
              <span>Show as</span>
              <select
                className="input"
                value={item.format ?? 'number'}
                onChange={(e) =>
                  onChange({
                    format: e.target.value as ReportItem['format'],
                    currency: item.currency ?? defaultCurrency(),
                  })
                }
              >
                <option value="number">Number</option>
                <option value="currency">Currency</option>
                <option value="percent">Percent</option>
              </select>
            </label>
            {item.format === 'currency' && (
              <label className="field">
                <span>Currency</span>
                <select className="input" value={item.currency ?? defaultCurrency()} onChange={(e) => onChange({ currency: e.target.value })}>
                  {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </>
      )}

      {item.kind === 'number' && (
        <label className="field">
          <span>Target (optional)</span>
          <input
            className="input"
            value={item.target ?? ''}
            placeholder="e.g. 36000 or =Budget!B9"
            onChange={(e) => onChange({ target: e.target.value })}
            inputMode="text"
          />
        </label>
      )}

      {item.kind !== 'number' && table && (
        <>
          <label className="field">
            <span>Labels from</span>
            <select className="input" value={item.labelCol ?? -1} onChange={(e) => onChange({ labelCol: Number(e.target.value) })}>
              <option value={-1}>Row numbers</option>
              {specs.map((_, c) => (
                <option key={c} value={c}>
                  {colOption(c)}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>{maxSeries === 1 ? 'Values from' : `Values from (up to ${maxSeries})`}</span>
            <div className="col-checks">
              {specs.map((s, c) => {
                const on = item.valueCols.includes(c);
                return (
                  <label key={c} className={`col-check ${on ? 'on' : ''}`}>
                    <input
                      type={maxSeries === 1 ? 'radio' : 'checkbox'}
                      checked={on}
                      onChange={() => {
                        if (maxSeries === 1) onChange({ valueCols: [c] });
                        else if (on) onChange({ valueCols: item.valueCols.filter((x) => x !== c) });
                        else onChange({ valueCols: [...item.valueCols, c].slice(-maxSeries).sort((a, b) => a - b) });
                      }}
                    />
                    {colOption(c)}
                    {isNumeric(s.type) && <span className="col-num">#</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}

      <button className="btn primary editor-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

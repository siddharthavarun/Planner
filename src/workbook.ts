import { useMemo } from 'react';
import { evaluate, parseNumber } from './formula';
import { isLiveGoal, useAppState } from './store';
import type { AppState, CalcKind, ColumnSpec, ColumnType, TableData } from './types';

/** A table somewhere in the planner. */
export interface TableRef {
  id: string; // block id
  goalId: string;
  name: string;
  /** Where it lives, e.g. "2027 › Finances › Budget". */
  label: string;
  data: TableData;
}

export type Result = { ok: true; value: number | null } | { ok: false; error: string };

export const isNumeric = (t: ColumnType) => t === 'number' || t === 'currency' || t === 'percent';

/** A sensible default currency for the viewer's region. */
export function defaultCurrency(): string {
  const region = (navigator.language.split('-')[1] ?? '').toUpperCase();
  const map: Record<string, string> = { US: 'USD', GB: 'GBP', IN: 'INR', JP: 'JPY', AU: 'AUD', CA: 'CAD', CH: 'CHF' };
  const euro = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'IE', 'PT', 'FI', 'GR', 'LU', 'SK', 'SI', 'EE', 'LV', 'LT', 'HR', 'MT', 'CY'];
  return map[region] ?? (euro.includes(region) ? 'EUR' : 'USD');
}

export function formatValue(value: number, spec: ColumnSpec, compact = false): string {
  const base: Intl.NumberFormatOptions = compact ? { notation: 'compact', maximumFractionDigits: 1 } : {};
  switch (spec.type) {
    case 'currency':
      return new Intl.NumberFormat(undefined, { ...base, style: 'currency', currency: spec.currency ?? 'USD' }).format(value);
    case 'percent':
      return new Intl.NumberFormat(undefined, { ...base, style: 'percent', maximumFractionDigits: compact ? 0 : 2 }).format(value);
    default:
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6, ...base }).format(value);
  }
}

export function columnSpecs(t: TableData): ColumnSpec[] {
  const cols = Math.max(1, ...t.rows.map((r) => r.length));
  return Array.from({ length: cols }, (_, c) => t.columns?.[c] ?? { type: 'text' });
}

export function dataRows(t: TableData): string[][] {
  return t.rows.slice(t.header ? 1 : 0);
}

/** Column heading: the header-row text if there is one, else "Column B". */
export function columnName(t: TableData, c: number): string {
  const head = t.header ? (t.rows[0]?.[c] ?? '').trim() : '';
  return head || `Column ${String.fromCharCode(65 + c)}`;
}

/** Every table in pages and goals that aren't in the bin, in page and goal order. */
export function listTables(s: AppState): TableRef[] {
  const out: TableRef[] = [];
  const visit = (goalId: string, path: string) => {
    const g = s.goals[goalId];
    if (!isLiveGoal(s, g)) return;
    const here = `${path} › ${g.title || 'Untitled'}`;
    let n = 0;
    for (const b of g.blocks) {
      if (b.type === 'table' && b.table) {
        n++;
        const name = b.table.name?.trim() || '';
        out.push({ id: b.id, goalId, name, label: `${here} › ${name || `Table ${n}`}`, data: b.table });
      }
      if (b.type === 'gallery') b.gallery?.goalIds.forEach((id) => visit(id, here));
    }
  };
  for (const p of s.pages) {
    if (p.deletedAt) continue;
    for (const id of p.goalOrder) if (s.goals[id] && !s.goals[id].parentId) visit(id, p.title || 'Untitled');
  }
  return out;
}

/**
 * Computes cells, column totals and formulas across all tables. Values are cached for the
 * lifetime of the workbook, which is rebuilt whenever the planner's data changes.
 */
export class Workbook {
  private byId = new Map<string, TableRef>();
  private byName = new Map<string, TableRef>();
  private cache = new Map<string, Result>();

  constructor(readonly tables: TableRef[]) {
    for (const t of tables) {
      this.byId.set(t.id, t);
      const key = t.name.toLowerCase();
      if (key && !this.byName.has(key)) this.byName.set(key, t);
    }
  }

  table(id: string | undefined): TableRef | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  /** True when another table already uses this name (names must be unique to be referenced). */
  nameTaken(name: string, exceptId: string): boolean {
    const t = this.byName.get(name.trim().toLowerCase());
    return !!t && t.id !== exceptId;
  }

  private sheetsFor(homeId: string | undefined, stack: Set<string>) {
    const resolve = (sheet?: string): TableRef => {
      const t = sheet ? this.byName.get(sheet.toLowerCase()) : this.table(homeId);
      if (!t) throw new Error(sheet ? `No table named “${sheet}”` : 'Name a table, e.g. Budget!B1');
      return t;
    };
    return {
      get: (col: number, row: number, sheet?: string) => {
        const t = resolve(sheet);
        const rows = dataRows(t.data);
        if (col < 0 || col >= columnSpecs(t.data).length || row < 0 || row >= rows.length) {
          throw new Error('No such cell');
        }
        const r = this.cell(t.id, col, row, stack);
        if (!r.ok) throw new Error(r.error);
        return r.value;
      },
      rowCount: (sheet?: string) => dataRows(resolve(sheet).data).length,
    };
  }

  /** The value of a data cell (row 0 is the first row under the header). */
  cell(tableId: string, c: number, r: number, stack = new Set<string>()): Result {
    const key = `${tableId}:${c}:${r}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (stack.has(key)) return { ok: false, error: 'Refers to itself' };
    const t = this.byId.get(tableId);
    if (!t) return { ok: true, value: null };
    const raw = (dataRows(t.data)[r]?.[c] ?? '').trim();
    const spec = columnSpecs(t.data)[c] ?? { type: 'text' };
    let res: Result;
    if (raw.startsWith('=')) {
      stack.add(key);
      try {
        res = { ok: true, value: evaluate(raw.slice(1), this.sheetsFor(tableId, stack)) };
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
    this.cache.set(key, res);
    return res;
  }

  /** A column summary; null when there is nothing to summarise. */
  calc(tableId: string, c: number, kind: CalcKind): number | null {
    const t = this.byId.get(tableId);
    if (!t || kind === 'none') return null;
    const rows = dataRows(t.data);
    const spec = columnSpecs(t.data)[c];
    if (kind === 'count') {
      return rows.filter((row) => (row[c] ?? '').trim() !== '' && (spec?.type !== 'checkbox' || row[c] === '1')).length;
    }
    const nums: number[] = [];
    rows.forEach((_, r) => {
      const v = this.cell(tableId, c, r);
      if (v.ok && v.value !== null) nums.push(v.value);
    });
    if (nums.length === 0) return null;
    if (kind === 'sum') return nums.reduce((a, b) => a + b, 0);
    if (kind === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (kind === 'min') return Math.min(...nums);
    return Math.max(...nums);
  }

  /** Evaluates a free-standing formula (used by report tiles). Leading "=" is optional. */
  formula(src: string, homeId?: string): Result {
    const text = src.trim().replace(/^=/, '');
    if (!text) return { ok: true, value: null };
    try {
      return { ok: true, value: evaluate(text, this.sheetsFor(homeId, new Set())) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error' };
    }
  }

  /** How to format values from a column (text, date and checkbox columns show plain numbers). */
  specOf(tableId: string | undefined, c: number): ColumnSpec {
    const t = this.table(tableId);
    const spec = t ? columnSpecs(t.data)[c] : undefined;
    return spec && isNumeric(spec.type) ? spec : { type: 'number' };
  }
}

/** The workbook for the current data, optionally with one table's latest edits applied. */
export function useWorkbook(override?: { id: string; data: TableData }): Workbook {
  const state = useAppState();
  return useMemo(() => {
    let tables = listTables(state);
    if (override) {
      tables = tables.some((t) => t.id === override.id)
        ? tables.map((t) => (t.id === override.id ? { ...t, data: override.data, name: override.data.name?.trim() || '' } : t))
        : [...tables, { id: override.id, goalId: '', name: override.data.name?.trim() || '', label: '', data: override.data }];
    }
    return new Workbook(tables);
  }, [state, override?.id, override?.data]);
}

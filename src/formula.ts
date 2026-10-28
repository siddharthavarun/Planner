// A small spreadsheet-style evaluator for table cells and reports. Supports + - * / % ^,
// parentheses, numbers, cell references (B2), ranges (B1:B4), whole columns (B), references
// into other tables by name (Budget!B2, 'Monthly budget'!B) and a few functions.
// It parses the text itself; nothing is ever passed to eval().

export interface Sheets {
  /** Value of a cell; `sheet` is a table name, or undefined for the current table. */
  /** null for an empty cell: ranges skip it, a single reference counts it as 0. */
  get: (col: number, row: number, sheet?: string) => number | null;
  /** Number of data rows, for whole-column references. */
  rowCount: (sheet?: string) => number;
}

/** Thrown when SUM/AVG/MIN/MAX get only empty cells: the formula's result is blank, not 0. */
class NoData extends Error {}
const needData = (a: number[]) => {
  if (a.length === 0) throw new NoData();
  return a;
};

const FUNCS: Record<string, (args: number[]) => number> = {
  SUM: (a) => needData(a).reduce((x, y) => x + y, 0),
  AVG: (a) => needData(a).reduce((x, y) => x + y, 0) / a.length,
  AVERAGE: (a) => needData(a).reduce((x, y) => x + y, 0) / a.length,
  MIN: (a) => Math.min(...needData(a)),
  MAX: (a) => Math.max(...needData(a)),
  COUNT: (a) => a.length,
  ROUND: (a) => {
    const f = 10 ** (a[1] ?? 0);
    return Math.round((a[0] ?? 0) * f) / f;
  },
  ABS: (a) => Math.abs(a[0] ?? 0),
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'ref'; col: number; row: number | null; sheet?: string }
  | { t: 'fn'; name: string }
  | { t: 'op'; v: string };

export const colLetter = (i: number) => String.fromCharCode(65 + i);

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?|^[0-9]+\.?/i.exec(src.slice(i))!;
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
    } else if (ch === "'" || /^[a-z_][a-z0-9_]*!/i.test(src.slice(i))) {
      // Table name before "!": Budget!B2 or 'Monthly budget'!B2
      let sheet: string;
      if (ch === "'") {
        const end = src.indexOf("'", i + 1);
        if (end < 0 || src[end + 1] !== '!') throw new Error("Use 'Table name'!B1");
        sheet = src.slice(i + 1, end);
        i = end + 2;
      } else {
        const m = /^([a-z_][a-z0-9_]*)!/i.exec(src.slice(i))!;
        sheet = m[1];
        i += m[0].length;
      }
      const m = /^([a-z])([0-9]*)/i.exec(src.slice(i));
      if (!m) throw new Error(`Expected a cell after ${sheet}!`);
      out.push({ t: 'ref', sheet, col: m[1].toUpperCase().charCodeAt(0) - 65, row: m[2] ? parseInt(m[2], 10) - 1 : null });
      i += m[0].length;
    } else if (/[a-z]/i.test(ch)) {
      const m = /^([a-z]+)([0-9]*)/i.exec(src.slice(i))!;
      const word = m[1].toUpperCase();
      if (!m[2] && src.slice(i + m[0].length).trimStart().startsWith('(')) {
        if (!FUNCS[word]) throw new Error(`Unknown function ${word}`);
        out.push({ t: 'fn', name: word });
      } else {
        if (word.length !== 1) throw new Error(`Unknown name ${word}`);
        out.push({ t: 'ref', col: word.charCodeAt(0) - 65, row: m[2] ? parseInt(m[2], 10) - 1 : null });
      }
      i += m[0].length;
    } else if ('+-*/%^(),:'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else {
      throw new Error(`Unexpected “${ch}”`);
    }
  }
  return out;
}

/**
 * Evaluates a formula (without the leading "="). Returns null when it summarises only empty
 * cells, e.g. a month with no spending entered yet.
 */
export function evaluate(src: string, sheets: Sheets): number | null {
  try {
    return evaluateStrict(src, sheets);
  } catch (err) {
    if (err instanceof NoData) return null;
    throw err;
  }
}

function evaluateStrict(src: string, sheets: Sheets): number {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected “${v}”`);
    pos++;
  };

  type Ref = { col: number; row: number | null; sheet?: string };
  const rangeValues = (a: Ref, b?: Ref): number[] => {
    const sheet = a.sheet;
    if (b && (b.sheet ?? sheet) !== sheet) throw new Error('A range must stay in one table');
    const last = sheets.rowCount(sheet) - 1;
    const r1 = a.row ?? 0;
    const r2 = b ? (b.row ?? last) : (a.row ?? last);
    const c1 = a.col;
    const c2 = b ? b.col : a.col;
    const vals: number[] = [];
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
        const v = sheets.get(c, r, sheet);
        if (v !== null) vals.push(v);
      }
    return vals;
  };

  // A function argument may be a range, which yields many values.
  const arg = (): number[] => {
    const t = peek();
    if (t?.t === 'ref') {
      const next = toks[pos + 1];
      const after = next?.t === 'op' ? next.v : null;
      // A lone reference as an argument behaves like a one-cell range, so empty cells are skipped.
      if (after === ':' || after === ',' || after === ')') {
        pos++;
        if (after === ':') {
          pos++;
          const b = peek();
          if (b?.t !== 'ref') throw new Error('Bad range');
          pos++;
          return rangeValues(t, b);
        }
        return rangeValues(t);
      }
    }
    return [expr()];
  };

  const primary = (): number => {
    const t = peek();
    if (!t) throw new Error('Incomplete formula');
    if (t.t === 'num') {
      pos++;
      return t.v;
    }
    if (t.t === 'ref') {
      pos++;
      if (t.row === null) throw new Error(`Use ${colLetter(t.col)} inside SUM(), or a cell like ${colLetter(t.col)}1`);
      return sheets.get(t.col, t.row, t.sheet) ?? 0;
    }
    if (t.t === 'fn') {
      pos++;
      expectOp('(');
      const args: number[] = [];
      if (!isOp(')')) {
        args.push(...arg());
        while (isOp(',')) {
          pos++;
          args.push(...arg());
        }
      }
      expectOp(')');
      return FUNCS[t.name](args);
    }
    if (isOp('(')) {
      pos++;
      const v = expr();
      expectOp(')');
      return v;
    }
    if (isOp('-')) {
      pos++;
      return -unary();
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    throw new Error('Unexpected symbol');
  };
  const unary = (): number => {
    let v = primary();
    if (isOp('%')) {
      pos++;
      v /= 100;
    }
    return v;
  };
  const power = (): number => {
    const base = unary();
    if (isOp('^')) {
      pos++;
      return base ** power();
    }
    return base;
  };
  const term = (): number => {
    let v = power();
    while (isOp('*') || isOp('/')) {
      const op = (toks[pos++] as { v: string }).v;
      const r = power();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[pos++] as { v: string }).v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  const v = expr();
  if (pos < toks.length) throw new Error('Unexpected symbol');
  if (!Number.isFinite(v)) throw new Error('Not a number (division by zero?)');
  return v;
}

/** Reads a typed number, ignoring currency symbols, spaces, thousands commas and a trailing %. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/[\s,£$€₹¥]/g, '').replace(/[A-Za-z]{3}$/, '');
  if (!s) return null;
  const pct = s.endsWith('%');
  const n = Number(pct ? s.slice(0, -1) : s);
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

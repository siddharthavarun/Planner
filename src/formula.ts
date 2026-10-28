// A small spreadsheet-style evaluator for table cells. Supports + - * / % ^, parentheses,
// numbers, cell references (B2), ranges (B1:B4), whole columns (B) and a few functions.
// It parses the text itself; nothing is ever passed to eval().

export type CellGetter = (col: number, row: number) => number;

const FUNCS: Record<string, (args: number[]) => number> = {
  SUM: (a) => a.reduce((x, y) => x + y, 0),
  AVG: (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0),
  AVERAGE: (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0),
  MIN: (a) => (a.length ? Math.min(...a) : 0),
  MAX: (a) => (a.length ? Math.max(...a) : 0),
  COUNT: (a) => a.length,
  ROUND: (a) => {
    const f = 10 ** (a[1] ?? 0);
    return Math.round((a[0] ?? 0) * f) / f;
  },
  ABS: (a) => Math.abs(a[0] ?? 0),
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'ref'; col: number; row: number | null }
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

/** Evaluates a formula (without the leading "="). */
export function evaluate(src: string, get: CellGetter, rowCount: number): number {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected “${v}”`);
    pos++;
  };

  const rangeValues = (a: { col: number; row: number | null }, b?: { col: number; row: number | null }): number[] => {
    const r1 = a.row ?? 0;
    const r2 = b ? (b.row ?? rowCount - 1) : a.row ?? rowCount - 1;
    const c1 = a.col;
    const c2 = b ? b.col : a.col;
    const vals: number[] = [];
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) vals.push(get(c, r));
    return vals;
  };

  // A function argument may be a range, which yields many values.
  const arg = (): number[] => {
    const t = peek();
    if (t?.t === 'ref') {
      const next = toks[pos + 1];
      const after = next?.t === 'op' ? next.v : null;
      if (after === ':' || (t.row === null && (after === ',' || after === ')'))) {
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
      return get(t.col, t.row);
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

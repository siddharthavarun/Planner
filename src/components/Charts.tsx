import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Categorical colours in fixed order (validated light and dark); a 7th+ series folds into "Other". */
export const SERIES_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c7)'];
const OTHER_COLOR = 'var(--fg3)';

export interface Series {
  name: string;
  values: (number | null)[];
  color: string;
}

interface ChartProps {
  labels: string[];
  series: Series[];
  format: (n: number) => string;
  compact: (n: number) => string;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round axis bounds and 3–5 clean ticks. */
function niceScale(min: number, max: number, count = 4) {
  if (min === max) {
    max = min === 0 ? 1 : min + Math.abs(min);
    min = Math.min(0, min);
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks };
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="chart-legend">
      {series.map((s) => (
        <span key={s.name}>
          <i style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function Readout({ label, series, index, format }: { label: string; series: Series[]; index: number; format: (n: number) => string }) {
  return (
    <div className="chart-readout">
      <b>{label}</b>
      {series.map((s) => (
        <span key={s.name}>
          {series.length > 1 && <i style={{ background: s.color }} />}
          {series.length > 1 && `${s.name} `}
          <strong>{s.values[index] === null ? '—' : format(s.values[index]!)}</strong>
        </span>
      ))}
    </div>
  );
}

// ---------- bar (horizontal, so long labels stay readable on phones) ----------

export function BarChart({ labels, series, format, compact }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { lo, hi } = niceScale(Math.min(0, ...all), Math.max(0, ...all));
  const labelW = Math.min(140, Math.max(70, width * 0.32));
  const valueW = 64;
  const plotW = Math.max(40, width - labelW - valueW);
  const bar = series.length === 1 ? 18 : Math.max(8, Math.min(14, 30 / series.length));
  const gap = 2;
  const band = series.length * bar + (series.length - 1) * gap + 14;
  const height = labels.length * band;
  const x = (v: number) => labelW + ((v - lo) / (hi - lo)) * plotW;
  const x0 = x(0);

  return (
    <div className="chart" ref={ref}>
      <Legend series={series} />
      <svg width={width} height={height} role="img" aria-label="Bar chart">
        <line x1={x0} x2={x0} y1={0} y2={height} className="chart-axis" />
        {labels.map((label, i) => {
          const top = i * band + 7;
          return (
            <g
              key={i}
              className={`bar-row ${active === i ? 'on' : ''} ${active !== null && active !== i ? 'dim' : ''}`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
              onClick={() => setActive(active === i ? null : i)}
            >
              <rect x={0} y={i * band} width={width} height={band} className="hit" />
              <text x={labelW - 10} y={top + (band - 14) / 2 + 4} textAnchor="end" className="chart-label">
                {label.length > 18 ? label.slice(0, 17) + '…' : label}
              </text>
              {series.map((s, si) => {
                const v = s.values[i];
                if (v === null) return null;
                const y = top + si * (bar + gap);
                const xa = Math.min(x0, x(v));
                const w = Math.max(1, Math.abs(x(v) - x0));
                const r = Math.min(4, w / 2, bar / 2);
                // Rounded at the data end, square at the baseline.
                const d =
                  v >= 0
                    ? `M${xa},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${bar - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`
                    : `M${xa + w},${y}h${-(w - r)}a${r},${r} 0 0 0 ${-r},${r}v${bar - 2 * r}a${r},${r} 0 0 0 ${r},${r}h${w - r}z`;
                return (
                  <g key={si}>
                    <path d={d} fill={s.color} />
                    {series.length === 1 && (
                      <text
                        x={v >= 0 ? xa + w + 6 : xa - 6}
                        y={y + bar / 2 + 4}
                        textAnchor={v >= 0 ? 'start' : 'end'}
                        className="chart-value"
                      >
                        {compact(v)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {active !== null && <Readout label={labels[active]} series={series} index={active} format={format} />}
    </div>
  );
}

// ---------- line ----------

export function LineChart({ labels, series, format, compact }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = 210;
  const pad = { top: 14, right: 16, bottom: 26, left: 48 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { lo, hi, ticks } = niceScale(Math.min(0, ...all), Math.max(...all, 0));
  const n = labels.length;
  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * plotH;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));

  const pick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - pad.left) / plotW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="chart" ref={ref}>
      <Legend series={series} />
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Line chart"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">
              {compact(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % every === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} className="chart-tick">
              {l.length > 10 ? l.slice(0, 9) + '…' : l}
            </text>
          ) : null,
        )}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotH} className="chart-cross" />}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          const path = pts.reduce((acc, p, i) => (p ? acc + `${acc && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]}` : acc), '');
          const lastIdx = s.values.reduce<number>((li, v, i) => (v === null ? li : i), -1);
          const area =
            series.length === 1 && lastIdx > 0
              ? `${path}L${x(lastIdx)},${y(Math.max(lo, 0))}L${x(s.values.findIndex((v) => v !== null))},${y(Math.max(lo, 0))}Z`
              : null;
          return (
            <g key={s.name}>
              {area && <path d={area} fill={s.color} opacity={0.1} />}
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {lastIdx >= 0 && <circle cx={x(lastIdx)} cy={y(s.values[lastIdx]!)} r={4} fill={s.color} className="chart-dot" />}
              {active !== null && s.values[active] !== null && (
                <circle cx={x(active)} cy={y(s.values[active]!)} r={5} fill={s.color} className="chart-dot" />
              )}
            </g>
          );
        })}
      </svg>
      {active !== null && <Readout label={labels[active]} series={series} index={active} format={format} />}
    </div>
  );
}

// ---------- donut ----------

export function DonutChart({ labels, values, format }: { labels: string[]; values: (number | null)[]; format: (n: number) => string }) {
  const [active, setActive] = useState<number | null>(null);
  let slices = labels
    .map((label, i) => ({ label, value: values[i] ?? 0 }))
    .filter((s) => s.value > 0);
  const total = slices.reduce((a, s) => a + s.value, 0);
  slices.sort((a, b) => b.value - a.value);
  const folded = slices.length > SERIES_COLORS.length;
  if (folded) {
    const rest = slices.slice(SERIES_COLORS.length - 1);
    slices = [...slices.slice(0, SERIES_COLORS.length - 1), { label: 'Other', value: rest.reduce((a, s) => a + s.value, 0) }];
  }
  const colored = slices.map((s, i) => ({
    ...s,
    color: folded && i === slices.length - 1 ? OTHER_COLOR : SERIES_COLORS[i],
  }));

  const size = 180;
  const r = 70;
  const stroke = 26;
  const c = 2 * Math.PI * r;
  let offset = 0;

  if (total <= 0) return <p className="chart-empty">Nothing to show yet: the values need to be above zero.</p>;

  return (
    <div className="chart donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {colored.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === i ? stroke + 6 : stroke}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-offset}
                className={`donut-slice ${active !== null && active !== i ? 'dim' : ''}`}
                onClick={() => setActive(active === i ? null : i)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut-total">
          {format(active === null ? total : colored[active].value)}
        </text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="donut-sub">
          {active === null ? 'Total' : colored[active].label.slice(0, 16)}
        </text>
      </svg>
      <ul className="donut-legend">
        {colored.map((s, i) => (
          <li
            key={i}
            className={active !== null && active !== i ? 'dim' : ''}
            onClick={() => setActive(active === i ? null : i)}
          >
            <i style={{ background: s.color }} />
            <span className="nm">{s.label}</span>
            <span className="amt">{format(s.value)}</span>
            <span className="pc">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

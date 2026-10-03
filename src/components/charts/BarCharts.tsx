"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Hand-written SVG charts. Colours come from CSS tokens so both themes work. */

export interface BarRow {
  key: string;
  label: string;
  /** 0–1 for rates, any non-negative value for counts. */
  value: number | null;
  interval?: [number, number] | null;
  n: number;
  tooltip: string;
}

const ROW_H = 34;
/** Below this width, bar labels sit above their bars instead of beside them. */
const NARROW = 480;

/**
 * Draw charts at the container's real pixel width, so text stays readable on
 * phones instead of shrinking with a scaled-down SVG.
 */
function useChartWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Horizontal gradient for a bar series, from the series colour to its deeper shade. */
function BarGradient({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stopColor={to} />
      <stop offset="100%" stopColor={from} />
    </linearGradient>
  );
}

function Tooltip({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink shadow-lg"
      style={{ left: x, top: y, transform: "translate(-50%, -110%)" }}
    >
      {text}
    </div>
  );
}

/**
 * Horizontal bars, one series. Rates show a 95% bootstrap interval whisker.
 * The value label sits in its own column so it never collides with bars.
 */
export function HBarChart({
  rows,
  max = 1,
  ticks: tickValues,
  format,
  title,
}: {
  rows: BarRow[];
  max?: number;
  /** Axis ticks. Defaults to quarters for rates and halves for counts. */
  ticks?: number[];
  format: (v: number) => string;
  title: string;
}) {
  const [hover, setHover] = useState<{ row: BarRow; x: number; y: number } | null>(null);
  const gradient = `bar-${useId().replace(/:/g, "")}`;
  const [ref, width] = useChartWidth();
  const narrow = width < NARROW;
  const LABEL_W = narrow ? 0 : Math.min(200, Math.round(width * 0.32));
  const VALUE_W = narrow ? 76 : 92;
  const rowH = narrow ? 50 : ROW_H;
  const plotW = width - LABEL_W - VALUE_W;
  const height = rows.length * rowH + 24;
  const scale = (v: number) => (max > 0 ? (Math.min(v, max) / max) * plotW : 0);
  const ticks = tickValues ?? (max === 1 ? [0, 0.25, 0.5, 0.75, 1] : [0, max / 2, max]);

  return (
    <div className="relative" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <BarGradient id={gradient} from="var(--series-1)" to="var(--series-1-end)" />
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={LABEL_W + scale(t)}
              x2={LABEL_W + scale(t)}
              y1={0}
              y2={rows.length * rowH}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={LABEL_W + scale(t)}
              y={rows.length * rowH + 16}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-3)"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = i * rowH;
          const barH = 16;
          const barY = narrow ? y + 24 : y + (rowH - barH) / 2;
          const midY = barY + barH / 2;
          const w = r.value === null ? 0 : scale(r.value);
          return (
            <g
              key={r.key}
              onMouseMove={(e) => {
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ row: r, x: e.clientX - box.left, y: e.clientY - box.top });
              }}
            >
              <rect x={0} y={y} width={width} height={rowH} fill="transparent" />
              <text x={0} y={narrow ? y + 15 : midY + 4} fontSize={12} fill="var(--text-2)">
                {r.label}
              </text>
              <rect x={LABEL_W} y={barY} width={plotW} height={barH} rx={barH / 2} fill="var(--grid)" />
              {w > 0 && (
                <rect x={LABEL_W} y={barY} width={Math.max(w, barH)} height={barH} rx={barH / 2} fill={`url(#${gradient})`} />
              )}
              {r.interval && (
                <g stroke="var(--text)" strokeWidth={1.5} opacity={0.7}>
                  <line
                    x1={LABEL_W + scale(r.interval[0])}
                    x2={LABEL_W + scale(r.interval[1])}
                    y1={midY}
                    y2={midY}
                  />
                  <line x1={LABEL_W + scale(r.interval[0])} x2={LABEL_W + scale(r.interval[0])} y1={barY - 3} y2={barY + barH + 3} />
                  <line x1={LABEL_W + scale(r.interval[1])} x2={LABEL_W + scale(r.interval[1])} y1={barY - 3} y2={barY + barH + 3} />
                </g>
              )}
              <text
                x={width}
                y={midY + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--text)"
                className="tabular"
              >
                {r.value === null ? "no data" : format(r.value)}
                <tspan fill="var(--text-3)"> n={r.n}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      {hover && <Tooltip text={hover.row.tooltip} x={hover.x} y={hover.y} />}
    </div>
  );
}

export interface PairRow {
  key: string;
  label: string;
  a: number | null;
  b: number | null;
  tooltip: string;
}

/**
 * Two series per row (stated share vs observed switch rate), both 0–1.
 * Series 1 = observed, series 2 = stated. A legend is always shown.
 */
export function PairedBarChart({
  rows,
  aLabel,
  bLabel,
  title,
}: {
  rows: PairRow[];
  aLabel: string;
  bLabel: string;
  title: string;
}) {
  const [hover, setHover] = useState<{ row: PairRow; x: number; y: number } | null>(null);
  const id = useId().replace(/:/g, "");
  const [ref, width] = useChartWidth();
  const labelW = width < NARROW ? 84 : 120;
  const rowH = 60;
  const plotW = width - labelW - 60;
  const height = rows.length * rowH + 24;
  const scale = (v: number) => v * plotW;
  const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

  return (
    <div className="relative" ref={ref}>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--series-1)" }} />
          {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--series-2)" }} />
          {bLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        <defs>
          <BarGradient id={`${id}-a`} from="var(--series-1)" to="var(--series-1-end)" />
          <BarGradient id={`${id}-b`} from="var(--series-2)" to="var(--series-2-end)" />
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={labelW + scale(t)} x2={labelW + scale(t)} y1={0} y2={rows.length * rowH} stroke="var(--grid)" />
            <text x={labelW + scale(t)} y={rows.length * rowH + 16} textAnchor="middle" fontSize={11} fill="var(--text-3)">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = i * rowH;
          const bar = (v: number | null, yy: number, fill: string) => (
            <>
              <rect x={labelW} y={yy} width={plotW} height={16} rx={8} fill="var(--grid)" />
              {v !== null && v > 0 && <rect x={labelW} y={yy} width={Math.max(scale(v), 16)} height={16} rx={8} fill={fill} />}
            </>
          );
          return (
            <g
              key={r.key}
              onMouseMove={(e) => {
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ row: r, x: e.clientX - box.left, y: e.clientY - box.top });
              }}
            >
              <rect x={0} y={y} width={width} height={rowH} fill="transparent" />
              <text x={0} y={y + rowH / 2 + 4} fontSize={13} fill="var(--text)" className="capitalize">
                {r.label}
              </text>
              {bar(r.a, y + 10, `url(#${id}-a)`)}
              {bar(r.b, y + 32, `url(#${id}-b)`)}
              <text x={width} y={y + 23} textAnchor="end" fontSize={12} fill="var(--text)">
                {pct(r.a)}
              </text>
              <text x={width} y={y + 45} textAnchor="end" fontSize={12} fill="var(--text)">
                {pct(r.b)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && <Tooltip text={hover.row.tooltip} x={hover.x} y={hover.y} />}
    </div>
  );
}

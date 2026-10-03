"use client";

import { useState } from "react";

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
const LABEL_W = 200;
const VALUE_W = 92;

function Tooltip({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 max-w-64 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink shadow-md"
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
  format,
  title,
}: {
  rows: BarRow[];
  max?: number;
  format: (v: number) => string;
  title: string;
}) {
  const [hover, setHover] = useState<{ row: BarRow; x: number; y: number } | null>(null);
  const width = 640;
  const plotW = width - LABEL_W - VALUE_W;
  const height = rows.length * ROW_H + 24;
  const scale = (v: number) => (max > 0 ? (Math.min(v, max) / max) * plotW : 0);
  const ticks = max === 1 ? [0, 0.25, 0.5, 0.75, 1] : [0, max / 2, max];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={LABEL_W + scale(t)}
              x2={LABEL_W + scale(t)}
              y1={0}
              y2={rows.length * ROW_H}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={LABEL_W + scale(t)}
              y={rows.length * ROW_H + 16}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-3)"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = i * ROW_H;
          const barY = y + 9;
          const barH = ROW_H - 18;
          const w = r.value === null ? 0 : scale(r.value);
          return (
            <g
              key={r.key}
              onMouseMove={(e) => {
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ row: r, x: e.clientX - box.left, y: e.clientY - box.top });
              }}
            >
              <rect x={0} y={y} width={width} height={ROW_H} fill="transparent" />
              <text x={0} y={y + ROW_H / 2 + 4} fontSize={12} fill="var(--text-2)">
                {r.label}
              </text>
              {w > 0 && (
                <path
                  d={`M${LABEL_W},${barY} h${Math.max(w - 4, 0)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h${-Math.max(w - 4, 0)} z`}
                  fill="var(--series-1)"
                />
              )}
              {r.interval && (
                <g stroke="var(--text)" strokeWidth={1.5}>
                  <line
                    x1={LABEL_W + scale(r.interval[0])}
                    x2={LABEL_W + scale(r.interval[1])}
                    y1={y + ROW_H / 2}
                    y2={y + ROW_H / 2}
                  />
                  <line x1={LABEL_W + scale(r.interval[0])} x2={LABEL_W + scale(r.interval[0])} y1={y + 12} y2={y + ROW_H - 12} />
                  <line x1={LABEL_W + scale(r.interval[1])} x2={LABEL_W + scale(r.interval[1])} y1={y + 12} y2={y + ROW_H - 12} />
                </g>
              )}
              <text
                x={width}
                y={y + ROW_H / 2 + 4}
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
  const width = 640;
  const rowH = 52;
  const plotW = width - 120 - 60;
  const height = rows.length * rowH + 24;
  const scale = (v: number) => v * plotW;
  const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-1)" }} />
          {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-2)" }} />
          {bLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={120 + scale(t)} x2={120 + scale(t)} y1={0} y2={rows.length * rowH} stroke="var(--grid)" />
            <text x={120 + scale(t)} y={rows.length * rowH + 16} textAnchor="middle" fontSize={11} fill="var(--text-3)">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = i * rowH;
          const bar = (v: number | null, yy: number, color: string) =>
            v !== null && v > 0 ? (
              <rect x={120} y={yy} width={Math.max(scale(v), 2)} height={16} rx={4} fill={color} />
            ) : null;
          return (
            <g
              key={r.key}
              onMouseMove={(e) => {
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ row: r, x: e.clientX - box.left, y: e.clientY - box.top });
              }}
            >
              <rect x={0} y={y} width={width} height={rowH} fill="transparent" />
              <text x={0} y={y + rowH / 2 + 4} fontSize={12} fill="var(--text-2)" className="capitalize">
                {r.label}
              </text>
              {bar(r.a, y + 8, "var(--series-1)")}
              {bar(r.b, y + 26, "var(--series-2)")}
              <text x={width} y={y + 20} textAnchor="end" fontSize={12} fill="var(--text)">
                {pct(r.a)}
              </text>
              <text x={width} y={y + 38} textAnchor="end" fontSize={12} fill="var(--text)">
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

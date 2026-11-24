import React, { useState } from 'react';
import { MonthlyRevenuePoint } from '../../types/crm';
import { formatCompactBRL, formatCurrencyBRL } from '../../lib/crm-engine';

interface RevenueChartProps {
  data: MonthlyRevenuePoint[];
  currentClosedRevenue: number;
  currentOpenPipeline: number;
  height?: number;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  currentClosedRevenue,
  currentOpenPipeline,
  height = 230,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sync the last point dynamically with live closed revenue & pipeline
  const points = data.map((pt, idx) =>
    idx === data.length - 1
      ? {
          ...pt,
          revenue: currentClosedRevenue,
          pipeline: currentOpenPipeline,
        }
      : pt
  );

  const width = 680;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;

  const maxVal = Math.max(
    100000,
    ...points.map((p) => Math.max(p.revenue, p.pipeline))
  );
  const niceMax = Math.ceil(maxVal / 50000) * 50000;

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const getX = (i: number) =>
    points.length <= 1
      ? padLeft
      : padLeft + (i / (points.length - 1)) * innerW;

  const getY = (val: number) =>
    padTop + innerH - (Math.max(0, val) / niceMax) * innerH;

  const buildSmoothPath = (vals: number[]) => {
    if (vals.length === 0) return '';
    const coords = vals.map((v, i) => ({ x: getX(i), y: getY(v) }));
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const cpX = (curr.x + next.x) / 2;
      d += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
    }
    return d;
  };

  const revenuePath = buildSmoothPath(points.map((p) => p.revenue));
  const pipelinePath = buildSmoothPath(points.map((p) => p.pipeline));

  const lastX = getX(points.length - 1);
  const firstX = getX(0);
  const baselineY = padTop + innerH;

  const revenueAreaPath = `${revenuePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceMax * t));

  const activePoint =
    hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Evolução de Receita e Funil
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            {activePoint.month} · Receita fechada{' '}
            <span className="text-[#E8C96D] font-mono tabular-nums font-medium">
              {formatCurrencyBRL(activePoint.revenue)}
            </span>{' '}
            · Pipeline ativo{' '}
            <span className="text-neutral-200 font-mono tabular-nums">
              {formatCurrencyBRL(activePoint.pipeline)}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#D4AF37] inline-block" />
            Receita fechada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-neutral-500 border-t border-dashed border-neutral-400 inline-block" />
            Funil aberto
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[420px]"
          role="img"
          aria-label="Gráfico de evolução mensal de receita fechada e pipeline comercial"
        >
          <defs>
            <linearGradient id="onethyGoldArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.34" />
              <stop offset="85%" stopColor="#D4AF37" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="onethyGoldLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#A68621" />
              <stop offset="55%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#F3DC8B" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#737A8C"
                  fontSize="10.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatCompactBRL(tick)}
                </text>
              </g>
            );
          })}

          {/* Subtle highlight band on active/last month */}
          {hoveredIndex !== null && (
            <line
              x1={getX(hoveredIndex)}
              y1={padTop}
              x2={getX(hoveredIndex)}
              y2={baselineY}
              stroke="rgba(212, 175, 55, 0.35)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Pipeline dashed reference line */}
          <path
            d={pipelinePath}
            fill="none"
            stroke="rgba(163, 172, 194, 0.38)"
            strokeWidth="1.75"
            strokeDasharray="4 4"
          />

          {/* Revenue Area + Smooth Gold Curve */}
          <path d={revenueAreaPath} fill="url(#onethyGoldArea)" />
          <path
            d={revenuePath}
            fill="none"
            stroke="url(#onethyGoldLine)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Data Nodes + X-axis Labels */}
          {points.map((pt, idx) => {
            const cx = getX(idx);
            const cy = getY(pt.revenue);
            const isActive =
              hoveredIndex === idx ||
              (hoveredIndex === null && idx === points.length - 1);

            return (
              <g
                key={pt.month}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                <rect
                  x={cx - 32}
                  y={padTop}
                  width={64}
                  height={innerH + padBottom}
                  fill="transparent"
                />
                {isActive && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="8"
                    fill="rgba(212, 175, 55, 0.22)"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? '4.5' : '3'}
                  fill={isActive ? '#F3DC8B' : '#171A22'}
                  stroke="#D4AF37"
                  strokeWidth="2"
                />
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  fill={isActive ? '#E8C96D' : '#8B92A5'}
                  fontSize="11"
                  fontWeight={isActive ? '600' : '400'}
                >
                  {pt.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

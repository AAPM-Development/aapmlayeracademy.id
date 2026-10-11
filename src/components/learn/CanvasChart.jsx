import React from "react";

const W = 640;
const H = 240;
const LEFT = 56;
const RIGHT = 616;
const TOP = 16;
const BOTTOM = 200;

/** Five evenly spaced, rounded ticks that cover every value. */
function niceTicks(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1, 2, 3, 4];
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const candidates = [1, 2, 2.5, 5, 10, 20, 25, 50].map((factor) => factor * magnitude);
  for (const step of candidates) {
    const start = Math.floor(min / step) * step;
    if (start + step * 4 >= max) return Array.from({ length: 5 }, (_, index) => Number((start + step * index).toFixed(6)));
  }
  const step = raw * 2;
  return Array.from({ length: 5 }, (_, index) => min + step * index);
}

/**
 * Line chart in the canvas `.chart` vocabulary (inline SVG): grid lines,
 * axis labels, an area under the first series, dots and an emphasised last
 * point. `series`: [{ values, hue?, secondary? }]; `band`: { from, to, label }.
 */
export default function CanvasLineChart({ labels = [], series = [], format = (value) => String(value), band = undefined, title = undefined, description = undefined }) {
  const all = series.flatMap((item) => item.values).concat(band ? [band.from, band.to] : []);
  const ticks = niceTicks(all);
  const low = ticks[0];
  const high = ticks[ticks.length - 1];
  const y = (value) => BOTTOM - ((value - low) / (high - low || 1)) * (BOTTOM - TOP);
  const step = labels.length > 1 ? (RIGHT - LEFT) / (labels.length - 1) : 0;
  const x = (index) => LEFT + index * step;
  const every = Math.max(1, Math.ceil(labels.length / 8));
  const titleId = React.useId();

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${titleId}-t ${titleId}-d`}>
      <title id={`${titleId}-t`}>{title}</title>
      <desc id={`${titleId}-d`}>{description}</desc>
      {band ? <rect className="band" x={LEFT} width={RIGHT - LEFT} y={y(Math.min(band.to, high))} height={Math.max(0, y(Math.max(band.from, low)) - y(Math.min(band.to, high)))} /> : null}
      {band ? <text className="band-label" x={RIGHT - 6} y={y(Math.min(band.to, high)) + 14} textAnchor="end">{band.label}</text> : null}
      {ticks.map((tick) => <line key={`g-${tick}`} className="grid-line" x1={LEFT} x2={RIGHT} y1={y(tick)} y2={y(tick)} />)}
      {ticks.map((tick) => <text key={`t-${tick}`} className="axis" x={LEFT - 12} y={y(tick) + 4} textAnchor="end">{format(tick)}</text>)}
      {labels.map((label, index) => (index % every === 0 || index === labels.length - 1 ? <text key={`x-${label}-${index}`} className="axis" x={x(index)} y={H - 14} textAnchor="middle">{label}</text> : null))}
      {series.map((item, seriesIndex) => {
        const points = item.values.map((value, index) => (Number.isFinite(value) ? [x(index), y(value)] : null)).filter(Boolean);
        if (!points.length) return null;
        const line = points.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
        const last = points[points.length - 1];
        return (
          <g key={seriesIndex} data-hue={item.hue}>
            {!item.secondary && seriesIndex === 0 && points.length > 1 ? <path className="area" d={`${line} L${last[0].toFixed(1)} ${BOTTOM} L${points[0][0].toFixed(1)} ${BOTTOM} Z`} /> : null}
            <path className={item.secondary ? "line-2" : "line"} d={line} />
            {points.slice(0, -1).map(([px, py]) => <circle key={`${px}-${py}`} className="dot" cx={px} cy={py} r="4" />)}
            <circle className="dot-last" cx={last[0]} cy={last[1]} r="6" />
          </g>
        );
      })}
    </svg>
  );
}

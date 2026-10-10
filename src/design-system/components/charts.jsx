import * as React from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart as RechartsLineChart, Bar, BarChart as RechartsBarChart, ReferenceArea, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import useReducedMotion from "@/lib/useReducedMotion";

// Recharts-backed charts live outside the design-system barrel so only the
// routes that draw charts download the library. Import from
// "@/design-system/charts".

const seriesHue = ["green", "blue", "orange", "violet", "teal", "amber", "rose"];
const hueVar = (hue) => `var(--aapm-semantic-hue-${hue})`;

function ChartTooltip({ active, payload, label, valueFormatter = (value) => value }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="aapm-chart-tooltip">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-sm" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="tabular-nums">{Number.isFinite(entry.value) ? valueFormatter(entry.value) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="aapm-chart-legend" aria-hidden="true">
      {series.map((item, index) => (
        <span key={item.id}><i style={{ background: hueVar(item.hue || seriesHue[index % seriesHue.length]) }} />{item.label}</span>
      ))}
    </div>
  );
}

/** Y axis wide enough for the longest formatted tick, so labels never clip. */
function axisWidth(values, valueFormatter) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return 48;
  const longest = Math.max(...[Math.min(...finite), Math.max(...finite)].map((value) => String(valueFormatter(value)).length));
  return Math.min(88, Math.max(40, longest * 7 + 12));
}

/** Round tick step (1, 2, 2.5, 5 × 10^n) for readable axes. */
function niceStep(raw) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

/** Padded domain around the data (and the reference band) with round ticks, instead of from 0. */
function niceScale(values, band, count = 5) {
  const finite = [...values, ...(band ? [band.from, band.to] : [])].filter((value) => Number.isFinite(value));
  if (!finite.length) return { domain: ["auto", "auto"], ticks: undefined };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
  const step = niceStep((max - min) / (count - 1));
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push(Number(value.toPrecision(6)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

function paddedDomain(values, band) {
  return niceScale(values, band).domain;
}

/**
 * One metric over time: a soft area under the line, the latest point
 * highlighted, and an optional reference band (`band` {from, to, label}).
 */
function TrendChart({ labels = [], values = [], label, hue = "green", height = 260, valueFormatter = (value) => String(value), band, ariaLabel, className }) {
  const reducedMotion = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const data = labels.map((name, index) => ({ label: name, value: Number.isFinite(values[index]) ? values[index] : null }));
  const color = hueVar(hue);
  const last = data.length - 1;
  const scale = niceScale(values, band);
  return (
    <figure className={cn("aapm-trend-chart m-0", className)} aria-label={ariaLabel}>
      <div className="aapm-trend-chart__plot" style={{ "--aapm-trend-chart-height": `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 14, right: 18, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            {band ? <ReferenceArea y1={band.from} y2={band.to} fill="var(--aapm-semantic-hue-green)" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" /> : null}
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} padding={{ left: 12, right: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={axisWidth(values, valueFormatter)} domain={scale.domain} ticks={scale.ticks} tickFormatter={(value) => valueFormatter(value)} />
            <RechartsTooltip cursor={{ stroke: "var(--aapm-semantic-border-strong)", strokeDasharray: "4 4" }} content={<ChartTooltip valueFormatter={valueFormatter} />} />
            <Area
              type="monotone"
              dataKey="value"
              name={label}
              stroke={color}
              strokeWidth={3}
              fill={`url(#fill-${id})`}
              connectNulls={false}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (!Number.isFinite(cx) || !Number.isFinite(cy)) return <g key={index} />;
                const latest = index === last;
                return <circle key={index} cx={cx} cy={cy} r={latest ? 6 : data.length <= 16 ? 3.5 : 0} fill={latest ? color : "var(--aapm-semantic-surface)"} stroke={color} strokeWidth={latest ? 3 : 2} className={latest ? "aapm-trend-chart__latest" : undefined} />;
              }}
              activeDot={{ r: 6, strokeWidth: 3, stroke: "var(--aapm-semantic-surface)" }}
              isAnimationActive={!reducedMotion}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Line chart with the former T7 contract: labels + series[{id,label,values}]. */
function LineChart({ labels = [], series = [], height = 240, valueFormatter = (value) => String(value), ariaLabel, title, summary, className }) {
  const reducedMotion = useReducedMotion();
  const data = labels.map((label, index) => {
    const point = { label };
    series.forEach((item) => { point[item.id] = Number.isFinite(item.values?.[index]) ? item.values[index] : null; });
    return point;
  });
  return (
    <figure className={cn("m-0 grid gap-3", className)} aria-label={ariaLabel}>
      {title ? <figcaption className="aapm-chart-panel__title">{title}</figcaption> : null}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} width={axisWidth(series.flatMap((item) => item.values || []), valueFormatter)} domain={paddedDomain(series.flatMap((item) => item.values || []))} tickFormatter={(value) => valueFormatter(value)} />
            <RechartsTooltip cursor={{ stroke: "var(--aapm-semantic-border-strong)" }} content={<ChartTooltip valueFormatter={valueFormatter} />} />
            {series.map((item, index) => (
              <Line
                key={item.id}
                type="monotone"
                dataKey={item.id}
                name={item.label}
                stroke={hueVar(item.hue || seriesHue[index % seriesHue.length])}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={!reducedMotion}
                animationDuration={700}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend series={series} />
      {summary ? <p className="aapm-chart-panel__description">{summary}</p> : null}
    </figure>
  );
}

function BarChart({ data = [], height = 220, valueFormatter = (value) => String(value), ariaLabel, hue = "green", className }) {
  return (
    <figure className={cn("m-0", className)} aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value) => valueFormatter(value)} />
          <RechartsTooltip cursor={{ fill: "var(--aapm-semantic-surface-subtle)" }} content={<ChartTooltip valueFormatter={valueFormatter} />} />
          <Bar dataKey="value" name="Nilai" fill={hueVar(hue)} radius={[6, 6, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </figure>
  );
}


export { LineChart, BarChart, TrendChart };

import * as React from "react";
import { CartesianGrid, Line, LineChart as RechartsLineChart, Bar, BarChart as RechartsBarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

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

/** Line chart with the former T7 contract: labels + series[{id,label,values}]. */
function LineChart({ labels = [], series = [], height = 240, valueFormatter = (value) => String(value), ariaLabel, title, summary, className }) {
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
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value) => valueFormatter(value)} />
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
                isAnimationActive
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


export { LineChart, BarChart };

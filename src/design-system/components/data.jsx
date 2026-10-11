import * as React from "react";
import { cn } from "@/lib/utils";
import { Ic } from "../canvas";
import { IconTile, Skeleton } from "./display";

// Canvas data display (academy.css §11): card › table-wrap › table, list
// rows, metric cards, deltas and inline SVG charts.

/* ----------------------------------------------------------------- Table */
const Table = React.forwardRef(/** @param {any} props @param {any} ref */ function Table({ className = undefined, wrapClassName = undefined, density = undefined, responsive = undefined, ...props }, ref) {
  return (
    <div className={cn("table-wrap", wrapClassName)}>
      <table ref={ref} className={cn("table", className)} data-density={density} data-responsive={responsive} {...props} />
    </div>
  );
});
const TableHeader = React.forwardRef(function TableHeader(props, ref) { return <thead ref={ref} {...props} />; });
const TableBody = React.forwardRef(function TableBody(props, ref) { return <tbody ref={ref} {...props} />; });
const TableFooter = React.forwardRef(function TableFooter(props, ref) { return <tfoot ref={ref} {...props} />; });
const TableRow = React.forwardRef(function TableRow(props, ref) { return <tr ref={ref} {...props} />; });
const TableHead = React.forwardRef(/** @param {any} props @param {any} ref */ function TableHead({ align = undefined, className = undefined, ...props }, ref) { return <th ref={ref} className={cn(align === "right" && "num", className)} {...props} />; });
const TableCell = React.forwardRef(/** @param {any} props @param {any} ref */ function TableCell({ align = undefined, className = undefined, ...props }, ref) { return <td ref={ref} className={cn(align === "right" && "num", className)} {...props} />; });
const TableCaption = React.forwardRef(function TableCaption(props, ref) { return <caption ref={ref} {...props} />; });

/**
 * Data table with the former T7 column contract:
 * { key, header, render?, align?, overflow?, sortable?, required? }.
 * `responsive="stacked"` turns rows into labelled records on phones; the
 * first `required` column becomes the record title.
 */
function DataTable({
  columns = [],
  rows = [],
  rowKey = (row, index) => String(row?.id ?? index),
  caption,
  density = "default",
  responsive = "scroll",
  loading = false,
  error = null,
  emptyMessage = "Belum ada data.",
  emptyState = null,
  sort,
  onSort,
  onRowClick,
  selectedKey,
  framed = true,
  footer,
  className,
  columnVisibility,
  ...props
}) {
  const visible = columns.filter((column) => column.required || columnVisibility?.[column.key] !== false);
  const primaryKey = (visible.find((column) => column.required) || visible[0])?.key;

  return (
    <div className={cn(framed && "card", "data-table", className)} {...props}>
      <Table density={density === "dense" ? "compact" : density} responsive={responsive}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {visible.map((column) => {
              const sorted = sort?.key === column.key ? sort.direction : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(column.align === "right" && "num", column.align === "end" && "act")}
                  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                >
                  {column.sortable && onSort ? (
                    <button type="button" className="th-sort" onClick={() => onSort(column.key)}>
                      {column.header}
                      <Ic name={sorted === "asc" ? "arrow-up" : sorted === "desc" ? "arrow-down" : "sort"} size="xs" />
                    </button>
                  ) : column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <tr key={`loading-${index}`}>
                {visible.map((column) => <td key={column.key}><Skeleton style={{ height: 14, maxWidth: 160 }} /></td>)}
              </tr>
            ))
          ) : error ? (
            <tr><td colSpan={visible.length}>{error}</td></tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={visible.length} data-primary="true">
                {emptyState || <p className="t-center t-muted" style={{ padding: "24px 0" }}>{emptyMessage}</p>}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const key = rowKey(row, index);
              return (
                <tr
                  key={key}
                  className={cn(onRowClick && "is-clickable", selectedKey !== undefined && selectedKey === key && "is-selected")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {visible.map((column) => (
                    <td
                      key={column.key}
                      data-label={typeof column.header === "string" ? column.header : undefined}
                      className={cn(column.align === "right" && "num", column.align === "end" && "act")}
                      data-overflow={column.overflow}
                      data-primary={column.key === primaryKey ? "true" : undefined}
                    >
                      {column.render ? column.render(row) : row?.[column.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
      {footer ? <div className="card-foot">{footer}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Trends */
/** Change against the previous period (`.delta`). Sentiment carries meaning, the arrow carries direction. */
function TrendIndicator({ direction = "flat", sentiment = "neutral", value, context, label, variant = "plain", className, ...props }) {
  const icon = direction === "up" ? "arrow-up" : direction === "down" ? "arrow-down" : "minus";
  const tone = sentiment === "positive" || sentiment === "good" ? "delta-good" : sentiment === "negative" || sentiment === "bad" ? "delta-bad" : "delta-flat";
  return (
    <span className={cn("delta", tone, className)} aria-label={label} {...props}>
      <Ic name={icon} />
      <span>{value}</span>
      {context ? <span className="t-muted" style={{ fontWeight: 500 }}>{context}</span> : null}
    </span>
  );
}

const colorwayHue = { 1: "green", 2: "blue", 3: "orange", 4: "violet", 5: "teal" };

/** Compact SVG signal (`.spark`); the parent supplies the business context. */
function Sparkline({ values = [], label = undefined, tone = undefined, colorway = undefined, hue = undefined, className = undefined, height = 28, ...props }) {
  const points = values.map(Number).filter((value) => Number.isFinite(value));
  if (points.length < 2) return null;
  const width = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coordinates = points.map((value, index) => [index * step, height - 3 - ((value - min) / range) * (height - 6)]);
  const line = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const resolvedHue = hue || colorwayHue[colorway] || ({ success: "green", danger: "rose", warning: "amber", info: "blue" })[tone];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("spark", className)}
      data-hue={resolvedHue}
      role="img"
      aria-label={label}
      style={{ height }}
      {...props}
    >
      <path className="area" d={area} />
      <path className="line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ----------------------------------------------------------------- KPIs */
const toneHue = { success: "green", info: "blue", warning: "amber", danger: "rose", neutral: undefined, primary: "green", attention: "ai" };

/**
 * One metric (`.card.metric`): tile + label, value, optional trend, note,
 * progress or chart. A hue makes it the tactile course card of the canvas.
 */
function MetricCard({ label, value, note, icon, trend, chart, progress, footer, action, hue, tone, colorway, emphasis, className, ...props }) {
  const resolvedHue = hue || (emphasis ? colorwayHue[colorway] || toneHue[tone] : undefined);
  const iconHue = resolvedHue || toneHue[tone] || colorwayHue[colorway] || "green";
  return (
    <div className={cn("card metric", resolvedHue && "card-tactile", className)} data-hue={iconHue} {...props}>
      <div className="row between gap-2">
        <span className="metric-label">
          {icon ? <IconTile icon={icon} size="sm" shape="circle" variant={resolvedHue ? "solid" : undefined} /> : null}
          {label}
        </span>
        {action}
      </div>
      <div className="row wrap gap-2" style={{ alignItems: "baseline" }}>
        <span className="metric-value">{value}</span>
        {trend}
      </div>
      {note ? <span className="metric-note">{note}</span> : null}
      {progress}
      {chart ? <div className="metric-chart">{chart}</div> : null}
      {footer ? <div className="metric-note">{footer}</div> : null}
    </div>
  );
}

/** Group of metrics (former KPICluster contract) on the canvas metric grid. */
function KPICluster({ items = [], columns = 4, label, variant = "cards", className, style, mobile, ...props }) {
  return (
    <section
      aria-label={label}
      className={cn(columns >= 4 ? "cols-4" : columns === 3 ? "cols-3" : columns === 2 ? "cols-2" : "grid-sm", "kpi-cluster", className)}
      data-variant={variant}
      style={style}
      {...props}
    >
      {items.map((item, index) => (
        <MetricCard key={item.key || item.label || index} {...item} />
      ))}
    </section>
  );
}

/* ----------------------------------------------------------- Chart panel */
function ChartPanel({ title, description, chart, actions, className, children, ...props }) {
  return (
    <section className={cn("card card-pad stack gap-4", className)} {...props}>
      {(title || description || actions) ? (
        <div className="card-head">
          <div className="stack gap-0-5" style={{ minWidth: 0 }}>
            {title ? <h3 className="card-title">{title}</h3> : null}
            {description ? <p className="card-desc">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {chart}
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- Filters */
function FilterToolbar({ title, summary, actions, className, children, ...props }) {
  return (
    <div className={cn("stack gap-3", className)} {...props}>
      {(title || summary) ? (
        <div className="stack gap-0-5">
          {title ? <h2 className="t-section">{title}</h2> : null}
          {summary ? <p className="t-support t-muted">{summary}</p> : null}
        </div>
      ) : null}
      <div className="toolbar">
        {children}
        {actions}
      </div>
    </div>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  DataTable,
  TrendIndicator,
  Sparkline,
  MetricCard,
  KPICluster,
  ChartPanel,
  FilterToolbar,
};

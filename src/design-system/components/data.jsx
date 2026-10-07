import * as React from "react";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { IconTile, Skeleton } from "./display";

/* ----------------------------------------------------------------- Table */
const Table = React.forwardRef(function Table({ className, wrapClassName, density, responsive, ...props }, ref) {
  return (
    <div className={cn("aapm-table-wrap", wrapClassName)}>
      <table ref={ref} className={cn("aapm-table", className)} data-density={density} data-responsive={responsive} {...props} />
    </div>
  );
});
const TableHeader = React.forwardRef(function TableHeader(props, ref) { return <thead ref={ref} {...props} />; });
const TableBody = React.forwardRef(function TableBody(props, ref) { return <tbody ref={ref} {...props} />; });
const TableFooter = React.forwardRef(function TableFooter(props, ref) { return <tfoot ref={ref} {...props} />; });
const TableRow = React.forwardRef(function TableRow(props, ref) { return <tr ref={ref} {...props} />; });
const TableHead = React.forwardRef(function TableHead({ align, ...props }, ref) { return <th ref={ref} data-align={align} {...props} />; });
const TableCell = React.forwardRef(function TableCell({ align, ...props }, ref) { return <td ref={ref} data-align={align} {...props} />; });
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
  className,
  columnVisibility,
  ...props
}) {
  const visible = columns.filter((column) => column.required || columnVisibility?.[column.key] !== false);
  const primaryKey = (visible.find((column) => column.required) || visible[0])?.key;

  return (
    <div className={cn("aapm-data-table", className)} {...props}>
      <Table density={density === "dense" ? "compact" : density} responsive={responsive}>
        {caption ? <caption className="aapm-visually-hidden">{caption}</caption> : null}
        <thead>
          <tr>
            {visible.map((column) => {
              const sorted = sort?.key === column.key ? sort.direction : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  data-align={column.align}
                  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                >
                  {column.sortable && onSort ? (
                    <button type="button" className="aapm-table__sort" onClick={() => onSort(column.key)}>
                      {column.header}
                      <AapmIcon name={sorted === "asc" ? "arrowUp" : sorted === "desc" ? "arrowDown" : "sort"} />
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
                {visible.map((column) => <td key={column.key}><Skeleton className="h-4 w-full max-w-[10rem]" /></td>)}
              </tr>
            ))
          ) : error ? (
            <tr><td colSpan={visible.length}>{error}</td></tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={visible.length} data-primary="true">
                {emptyState || <p className="py-6 text-center text-muted-foreground">{emptyMessage}</p>}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                data-clickable={onRowClick ? "true" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {visible.map((column) => (
                  <td
                    key={column.key}
                    data-label={column.header}
                    data-align={column.align}
                    data-overflow={column.overflow}
                    data-primary={column.key === primaryKey ? "true" : undefined}
                  >
                    {column.render ? column.render(row) : row?.[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}

/* ---------------------------------------------------------------- Trends */
function TrendIndicator({ direction = "flat", sentiment = "neutral", value, context, label, variant = "plain", className, ...props }) {
  const icon = direction === "up" ? "arrowUp" : direction === "down" ? "arrowDown" : "glyphMinus";
  return (
    <span className={cn("aapm-trend", className)} data-sentiment={sentiment} data-variant={variant} aria-label={label} {...props}>
      <AapmIcon name={icon} />
      <span>{value}</span>
      {context ? <span className="aapm-trend__context">{context}</span> : null}
    </span>
  );
}

const colorwayHue = { 1: "green", 2: "blue", 3: "orange", 4: "violet", 5: "teal" };

/** Compact SVG signal; the parent supplies the business context. */
function Sparkline({ values = [], label, tone, colorway, hue, className, height = 36, ...props }) {
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
  const resolvedHue = hue || (tone && tone !== "chart" ? undefined : colorwayHue[colorway]);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("aapm-sparkline", className)}
      data-tone={tone && tone !== "chart" ? tone : undefined}
      data-hue={resolvedHue}
      role="img"
      aria-label={label}
      style={{ height }}
      {...props}
    >
      <path d={area} fill="currentColor" opacity="0.12" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ----------------------------------------------------------------- KPIs */
const toneHue = { success: "green", info: "blue", warning: "amber", danger: "rose", neutral: undefined, primary: "green", attention: "orange" };

/**
 * One metric: label, value, optional icon/trend/note/chart. A `hue` (or the
 * legacy tone/colorway pair with `emphasis`) gives the colourful course tint.
 */
function MetricCard({ label, value, note, icon, trend, chart, progress, footer, action, hue, tone, colorway, emphasis, className, ...props }) {
  const resolvedHue = hue || (emphasis ? colorwayHue[colorway] || toneHue[tone] : undefined);
  const iconHue = resolvedHue || toneHue[tone] || colorwayHue[colorway] || "green";
  return (
    <div className={cn("aapm-metric", className)} data-hue={resolvedHue} {...props}>
      <div className="aapm-metric__head">
        <p className="aapm-metric__label">{label}</p>
        {action || (icon ? <IconTile icon={icon} hue={iconHue} size="sm" shape="circle" variant={resolvedHue ? "badge" : undefined} /> : null)}
      </div>
      <div className="aapm-metric__value-row">
        <p className="aapm-metric__value">{value}</p>
        {trend}
      </div>
      {note ? <p className="aapm-metric__note">{note}</p> : null}
      {progress}
      {chart ? <div className="aapm-metric__footer">{chart}</div> : null}
      {footer ? <div className="aapm-metric__footer">{footer}</div> : null}
    </div>
  );
}

/** Group of metrics (former KPICluster contract). */
function KPICluster({ items = [], columns = 4, label, variant = "cards", className, style, mobile, ...props }) {
  return (
    <section
      aria-label={label}
      className={cn("aapm-kpi-group", className)}
      data-variant={variant}
      data-mobile={mobile}
      style={{ "--kpi-columns": columns, ...style }}
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
    <section className={cn("aapm-chart-panel", className)} {...props}>
      {(title || description || actions) ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="aapm-chart-panel__title">{title}</h3> : null}
            {description ? <p className="aapm-chart-panel__description">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      {chart}
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- Filters */
function FilterToolbar({ title, summary, actions, className, children, ...props }) {
  return (
    <div className={cn("aapm-filter-toolbar", className)} {...props}>
      {(title || summary) ? (
        <div className="min-w-0">
          {title ? <h2 className="aapm-filter-toolbar__title">{title}</h2> : null}
          {summary ? <p className="aapm-filter-toolbar__summary">{summary}</p> : null}
        </div>
      ) : null}
      <div className="aapm-filter-toolbar__controls">
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

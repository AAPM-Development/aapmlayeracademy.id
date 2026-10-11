import * as React from "react";
import { Link } from "react-router-dom";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { Ic } from "../canvas";

/* ----------------------------------------------------------- Page header */
/**
 * Page head (`.ph`): back link · eyebrow · title · description, actions on
 * the right. One title per route.
 */
function PageHeader({ eyebrow, title, description, actions, back, size = "default", className, children, ...props }) {
  return (
    <header className={cn("ph", className)} {...props}>
      <div className="ph-copy">
        {back ? (
          <Link to={back.to} className="ph-back">
            <Ic name="arrow-left" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <span className="t-overline t-muted">{eyebrow}</span> : null}
        <h1 className={size === "compact" ? "t-title-c" : "ph-title"}>{title}</h1>
        {description ? <p className="ph-desc">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
    </header>
  );
}

/**
 * Section head. `variant="card"` is the head inside a card (`.card-head`:
 * card-title + card-desc); the default is the page-level `.sh`.
 */
function SectionHeader({ title, description, actions, size, variant, as: Heading = "h2", id, className }) {
  if (variant === "card") {
    return (
      <div className={cn("card-head", className)}>
        <div className="stack gap-0-5" style={{ minWidth: 0 }}>
          <Heading id={id} className="card-title">{title}</Heading>
          {description ? <p className="card-desc">{description}</p> : null}
        </div>
        {actions ? <div className="row wrap gap-2">{actions}</div> : null}
      </div>
    );
  }
  return (
    <div className={cn("sh", className)}>
      <div className="stack gap-1" style={{ minWidth: 0 }}>
        <Heading id={id} className={size === "sm" ? "t-section" : "sh-title"}>{title}</Heading>
        {description ? <p className="sh-desc">{description}</p> : null}
      </div>
      {actions ? <div className="row wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Linked breadcrumb trail (`.crumbs`); the last level is the current page. */
function Breadcrumbs({ items = [], className }) {
  return (
    <nav aria-label="Lokasi saat ini" className={cn("crumbs", className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? <Ic name="chev-right" /> : null}
            {item.to && !last ? <Link to={item.to}>{item.label}</Link> : <span className={last ? "cur t-clamp-1" : undefined} aria-current={last ? "page" : undefined}>{item.label}</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ Tabs */
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(function TabsList({ className, variant, ...props }, ref) {
  return <TabsPrimitive.List ref={ref} className={cn(variant === "segmented" ? "seg" : "tabs", className)} {...props} />;
});

const TabsTrigger = React.forwardRef(function TabsTrigger({ className, icon, children, count, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger ref={ref} className={cn("tab", className)} {...props}>
      {icon ? <AapmIcon name={icon} /> : null}
      {children}
      {count !== undefined ? <span className="count">{count}</span> : null}
    </TabsPrimitive.Trigger>
  );
});

const TabsContent = React.forwardRef(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn("tabs-content", className)} {...props} />;
});

/** Mutually exclusive view switch (`.seg`): list/board, period, filter. */
function SegmentedControl({ label, options = [], value, onChange, className, size, block = false }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("seg", block && "seg-block", size === "sm" && "seg-sm", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange?.(option.value)}
        >
          {option.icon ? <AapmIcon name={option.icon} /> : null}
          {option.label}
          {option.count !== undefined ? <span className="count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- ScrollArea */
const ScrollArea = React.forwardRef(function ScrollArea({ className, children, viewportRef, ...props }, ref) {
  const setRef = React.useCallback((node) => {
    if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
    if (typeof viewportRef === "function") viewportRef(node); else if (viewportRef) viewportRef.current = node;
  }, [ref, viewportRef]);
  return <div ref={setRef} className={cn("min-h-0 overflow-y-auto overscroll-contain", className)} data-radix-scroll-area-viewport="" {...props}>{children}</div>;
});
const ScrollBar = () => null;

/* ------------------------------------------------------------- Accordion */
const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef(function AccordionItem({ className, ...props }, ref) {
  return <AccordionPrimitive.Item ref={ref} className={cn("accordion-item", className)} {...props} />;
});

const AccordionTrigger = React.forwardRef(function AccordionTrigger({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger ref={ref} className={cn("accordion-trigger", className)} {...props}>
        {children}
        <Ic name="chev-down" className="accordion-chevron t-muted" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

const AccordionContent = React.forwardRef(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content ref={ref} className="accordion-content" {...props}>
      <div className={className}>{children}</div>
    </AccordionPrimitive.Content>
  );
});

export {
  PageHeader,
  SectionHeader,
  Breadcrumbs,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SegmentedControl,
  ScrollArea,
  ScrollBar,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
};

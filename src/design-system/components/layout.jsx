import * as React from "react";
import { Link } from "react-router-dom";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------- Page header */
/**
 * Answers "where am I, and what can I do here?". One title per route;
 * eyebrow names the area, actions hold the page's primary action.
 */
function PageHeader({ eyebrow, title, description, actions, back, size = "default", className, children, ...props }) {
  return (
    <header className={cn("aapm-page-header", className)} {...props}>
      <div className="aapm-page-header__copy">
        {back ? (
          <Link to={back.to} className="aapm-page-header__back">
            <AapmIcon name="arrowLeft" />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="aapm-page-header__eyebrow aapm-text-overline">{eyebrow}</p> : null}
        <h1 className={cn("aapm-page-header__title", size === "compact" ? "aapm-text-title-compact" : "aapm-text-title")}>{title}</h1>
        {description ? <p className="aapm-page-header__description">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="aapm-page-header__actions">{actions}</div> : null}
    </header>
  );
}

function SectionHeader({ title, description, actions, size, as: Heading = "h2", id, className }) {
  return (
    <div className={cn("aapm-section-header", className)}>
      <div className="min-w-0">
        <Heading id={id} className="aapm-section-header__title" data-size={size}>{title}</Heading>
        {description ? <p className="aapm-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="aapm-section-header__actions">{actions}</div> : null}
    </div>
  );
}

function Breadcrumbs({ items = [], className }) {
  return (
    <nav aria-label="Lokasi saat ini" className={cn("aapm-breadcrumbs", className)}>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {index > 0 ? <AapmIcon name="chevronRight" /> : null}
              {item.to && !last ? <Link to={item.to}>{item.label}</Link> : <span aria-current={last ? "page" : undefined}>{item.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ Tabs */
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(function TabsList({ className, variant, ...props }, ref) {
  return <TabsPrimitive.List ref={ref} className={cn("aapm-tabs-list", className)} data-variant={variant} {...props} />;
});

const TabsTrigger = React.forwardRef(function TabsTrigger({ className, icon, children, count, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger ref={ref} className={cn("aapm-tabs-trigger", className)} {...props}>
      {icon ? <AapmIcon name={icon} /> : null}
      {children}
      {count !== undefined ? <span className="aapm-chip" data-size="sm">{count}</span> : null}
    </TabsPrimitive.Trigger>
  );
});

const TabsContent = React.forwardRef(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn("aapm-tabs-content", className)} {...props} />;
});

/** Mutually exclusive view switch (list/board, period, filter). */
function SegmentedControl({ label, options = [], value, onChange, className, size, block = false }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("aapm-segmented", className)} data-block={block ? "true" : undefined}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-pressed={value === option.value}
          className="aapm-tabs-trigger"
          data-size={size}
          onClick={() => onChange?.(option.value)}
        >
          {option.icon ? <AapmIcon name={option.icon} /> : null}
          {option.label}
          {option.count !== undefined ? <span className="aapm-segmented__count">{option.count}</span> : null}
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
  return <AccordionPrimitive.Item ref={ref} className={cn("aapm-accordion-item", className)} {...props} />;
});

const AccordionTrigger = React.forwardRef(function AccordionTrigger({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger ref={ref} className={cn("aapm-accordion-trigger", className)} {...props}>
        {children}
        <AapmIcon name="chevronDown" className="aapm-accordion-chevron" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

const AccordionContent = React.forwardRef(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content ref={ref} className="aapm-accordion-content" {...props}>
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

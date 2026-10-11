import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SliderPrimitive from "@radix-ui/react-slider";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";
import { Ic } from "../canvas";

// Canvas form vocabulary (academy.css §10): .field > .label + control + .hint.

/* ----------------------------------------------------------------- Field */
const Label = React.forwardRef(function Label({ className, required, children, ...props }, ref) {
  return (
    <LabelPrimitive.Root ref={ref} className={cn("label", className)} {...props}>
      <span>{children}{required ? <span className="req" aria-hidden="true"> *</span> : null}</span>
    </LabelPrimitive.Root>
  );
});

/**
 * Label + control + hint/error, with the description wired to the control.
 * Pass a single control as the child; `id` links label and description.
 */
function Field({ id, label, hint, error, required = false, className, children, labelAction }) {
  const generated = React.useId();
  const controlId = id || generated;
  const descriptionId = hint || error ? `${controlId}-description` : undefined;
  const child = React.Children.only(children);
  const control = React.isValidElement(child)
    ? React.cloneElement(child, {
      id: child.props.id || controlId,
      "aria-describedby": [child.props["aria-describedby"], descriptionId].filter(Boolean).join(" ") || undefined,
      "aria-invalid": error ? true : child.props["aria-invalid"],
      required: child.props.required ?? (required || undefined),
    })
    : child;

  return (
    <div className={cn("field", className)}>
      {label ? (
        <div className="row between gap-2">
          <Label htmlFor={controlId} required={required}>{label}</Label>
          {labelAction}
        </div>
      ) : null}
      {control}
      {error ? (
        <p id={descriptionId} className="hint hint-error" role="alert"><Ic name="alert" size="xs" />{error}</p>
      ) : hint ? (
        <p id={descriptionId} className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

const Input = React.forwardRef(function Input({ className, invalid, type = "text", ...props }, ref) {
  return <input ref={ref} type={type} className={cn("input", className)} aria-invalid={invalid || props["aria-invalid"] || undefined} {...props} />;
});

const Textarea = React.forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} className={cn("textarea", className)} aria-invalid={invalid || props["aria-invalid"] || undefined} {...props} />;
});

/** Input box (`.input`) with a leading icon, an optional unit and/or trailing action. */
const InputGroup = React.forwardRef(function InputGroup({ leadingIcon, trailing, unit, className, inputClassName, size, invalid, ...props }, ref) {
  return (
    <div className={cn("input", size === "sm" && "input-sm", size === "lg" && "input-lg", className)} data-invalid={invalid || props["aria-invalid"] ? "true" : undefined}>
      {leadingIcon ? <AapmIcon name={leadingIcon} /> : null}
      <input ref={ref} className={inputClassName} aria-invalid={invalid || props["aria-invalid"] || undefined} {...props} />
      {unit ? <span className="unit">{unit}</span> : null}
      {trailing}
    </div>
  );
});

const SearchInput = React.forwardRef(function SearchInput({ placeholder = "Cari…", className, inputClassName, ...props }, ref) {
  return (
    <label className={cn("search", className)}>
      <Ic name="search" size="sm" />
      <input ref={ref} type="search" placeholder={placeholder} className={inputClassName} {...props} />
    </label>
  );
});

const PasswordInput = React.forwardRef(function PasswordInput(
  { className, revealLabel = "Tampilkan kata sandi", hideLabel = "Sembunyikan kata sandi", leadingIcon, ...props },
  ref,
) {
  const [visible, setVisible] = React.useState(false);
  return (
    <InputGroup
      ref={ref}
      className={className}
      leadingIcon={leadingIcon}
      type={visible ? "text" : "password"}
      autoComplete={props.autoComplete || "current-password"}
      trailing={(
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon btn-quiet input-action"
          aria-label={visible ? hideLabel : revealLabel}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Ic name="eye" />
        </button>
      )}
      {...props}
    />
  );
});

/* ---------------------------------------------------------------- Select */
const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(function SelectTrigger({ className, children, size, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger ref={ref} className={cn("select select-trigger", size === "sm" && "select-sm", className)} {...props}>
      {children}
    </SelectPrimitive.Trigger>
  );
});

const SelectScrollUpButton = React.forwardRef(function SelectScrollUpButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton ref={ref} className={cn("row justify-center t-muted", className)} style={{ padding: 4 }} {...props}>
      <Ic name="chev-up" size="sm" />
    </SelectPrimitive.ScrollUpButton>
  );
});

const SelectScrollDownButton = React.forwardRef(function SelectScrollDownButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton ref={ref} className={cn("row justify-center t-muted", className)} style={{ padding: 4 }} {...props}>
      <Ic name="chev-down" size="sm" />
    </SelectPrimitive.ScrollDownButton>
  );
});

const SelectContent = React.forwardRef(function SelectContent({ className, children, position = "popper", sideOffset = 6, ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn("menu menu-pop", className)}
        data-select="true"
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="menu-viewport">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

const SelectLabel = React.forwardRef(function SelectLabel({ className, ...props }, ref) {
  return <SelectPrimitive.Label ref={ref} className={cn("menu-label", className)} {...props} />;
});

const SelectItem = React.forwardRef(function SelectItem({ className, children, description, ...props }, ref) {
  return (
    <SelectPrimitive.Item ref={ref} className={cn("menu-item", className)} data-select="true" {...props}>
      <span className="menu-check">
        <SelectPrimitive.ItemIndicator><Ic name="check" size="sm" /></SelectPrimitive.ItemIndicator>
      </span>
      <span className="stack" style={{ minWidth: 0 }}>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description ? <span className="t-caption t-muted">{description}</span> : null}
      </span>
    </SelectPrimitive.Item>
  );
});

const SelectSeparator = React.forwardRef(function SelectSeparator({ className, ...props }, ref) {
  return <SelectPrimitive.Separator ref={ref} className={cn("menu-sep", className)} {...props} />;
});

/* -------------------------------------------------------------- Choices */
const Checkbox = React.forwardRef(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root ref={ref} className={cn("checkbox", className)} {...props}>
      <CheckboxPrimitive.Indicator className="row justify-center">
        {props.checked === "indeterminate" ? <Ic name="minus" size="xs" /> : <Ic name="check" size="xs" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

/**
 * Native checkbox row (`.check`) with label/description, for checklists that
 * are uncontrolled or form-submitted (the former T7Checkbox contract).
 */
const CheckboxField = React.forwardRef(function CheckboxField({ id, label, description, className, ...props }, ref) {
  const generated = React.useId();
  const inputId = id || generated;
  return (
    <label htmlFor={inputId} className={cn("check", className)}>
      <input ref={ref} id={inputId} type="checkbox" {...props} />
      <span className="stack gap-0-5" style={{ minWidth: 0 }}>
        <span>{label}</span>
        {description ? <span className="t-caption t-muted">{description}</span> : null}
      </span>
    </label>
  );
});

const RadioGroup = React.forwardRef(function RadioGroup({ className, ...props }, ref) {
  return <RadioGroupPrimitive.Root ref={ref} className={cn("stack gap-2", className)} {...props} />;
});

const RadioGroupItem = React.forwardRef(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item ref={ref} className={cn("radio", className)} {...props}>
      <RadioGroupPrimitive.Indicator className="radio-dot" />
    </RadioGroupPrimitive.Item>
  );
});

const Switch = React.forwardRef(function Switch({ className, tone, ...props }, ref) {
  return (
    <SwitchPrimitive.Root ref={ref} className={cn("switch-ctl", tone === "ai" && "switch-ctl-ai", className)} {...props}>
      <SwitchPrimitive.Thumb className="switch-thumb" />
    </SwitchPrimitive.Root>
  );
});

/* Toggle row: a setting with a title, an optional explanation, and a switch.
 * The whole row is the label, so the switch is easy to hit on touch. */
const SwitchField = React.forwardRef(function SwitchField({ id, label, description, className, ...props }, ref) {
  const generated = React.useId();
  const inputId = id || generated;
  return (
    <div className={cn("row between gap-4 switch-row", className)}>
      <div className="stack gap-0-5 grow">
        <label htmlFor={inputId} className="t-body t-medium">{label}</label>
        {description ? <p className="t-caption t-muted">{description}</p> : null}
      </div>
      <Switch ref={ref} id={inputId} {...props} />
    </div>
  );
});

const Slider = React.forwardRef(function Slider({ className, ...props }, ref) {
  const thumbs = Array.isArray(props.value) ? props.value : Array.isArray(props.defaultValue) ? props.defaultValue : [0];
  return (
    <SliderPrimitive.Root ref={ref} className={cn("slider", className)} {...props}>
      <SliderPrimitive.Track className="slider-track">
        <SliderPrimitive.Range className="slider-range" />
      </SliderPrimitive.Track>
      {thumbs.map((_, index) => <SliderPrimitive.Thumb key={index} className="slider-thumb" />)}
    </SliderPrimitive.Root>
  );
});

/* ---------------------------------------------------------- Form layout */
/** Settings section (`.form-section`): 240 px intro column beside the fields. */
function FormSection({ title, description, action, className, children, ...props }) {
  return (
    <section className={cn("form-section", className)} {...props}>
      {(title || description || action) ? (
        <div className="stack gap-1">
          {title ? <h3 className="t-heading">{title}</h3> : null}
          {description ? <p className="t-support t-muted">{description}</p> : null}
          {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
        </div>
      ) : <span />}
      <div className="stack gap-4" style={{ minWidth: 0 }}>{children}</div>
    </section>
  );
}

function FormGrid({ columns = 2, className, style, ...props }) {
  return <div className={cn("form-grid", columns === 1 && "form-grid-1", className)} style={style} {...props} />;
}

function FormActions({ className, ...props }) {
  return <div className={cn("row wrap justify-end gap-2", className)} {...props} />;
}

export {
  Label,
  Field,
  Input,
  Textarea,
  InputGroup,
  SearchInput,
  PasswordInput,
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  Checkbox,
  CheckboxField,
  SwitchField,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Slider,
  FormSection,
  FormGrid,
  FormActions,
};

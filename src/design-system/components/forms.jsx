import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SliderPrimitive from "@radix-ui/react-slider";
import AapmIcon from "@/components/icons/AapmIcon";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------- Field */
const Label = React.forwardRef(function Label({ className, required, ...props }, ref) {
  return <LabelPrimitive.Root ref={ref} className={cn("aapm-label", className)} data-required={required ? "true" : undefined} {...props} />;
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
    <div className={cn("aapm-field", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={controlId} required={required}>{label}</Label>
          {labelAction}
        </div>
      ) : null}
      {control}
      {error ? (
        <p id={descriptionId} className="aapm-field-error" role="alert">{error}</p>
      ) : hint ? (
        <p id={descriptionId} className="aapm-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

const Input = React.forwardRef(function Input({ className, invalid, type = "text", ...props }, ref) {
  return <input ref={ref} type={type} className={cn("aapm-input", className)} aria-invalid={invalid || props["aria-invalid"] || undefined} {...props} />;
});

const Textarea = React.forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} className={cn("aapm-textarea", className)} aria-invalid={invalid || props["aria-invalid"] || undefined} {...props} />;
});

/** Input with a leading icon and/or trailing action. */
const InputGroup = React.forwardRef(function InputGroup({ leadingIcon, trailing, className, inputClassName, ...props }, ref) {
  return (
    <div className={cn("aapm-input-group", className)}>
      {leadingIcon ? <span className="aapm-input-group__prefix"><AapmIcon name={leadingIcon} /></span> : null}
      <Input ref={ref} className={inputClassName} {...props} />
      {trailing ? <span className="aapm-input-group__suffix">{trailing}</span> : null}
    </div>
  );
});

const SearchInput = React.forwardRef(function SearchInput({ placeholder = "Cari…", ...props }, ref) {
  return <InputGroup ref={ref} type="search" leadingIcon="search" placeholder={placeholder} {...props} />;
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
          className="aapm-button"
          data-variant="ghost"
          data-size="icon-sm"
          aria-label={visible ? hideLabel : revealLabel}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <AapmIcon name={visible ? "eyeOff" : "eye"} />
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
    <SelectPrimitive.Trigger ref={ref} className={cn("aapm-select-trigger", className)} data-size={size} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <AapmIcon name="chevronDown" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

const SelectScrollUpButton = React.forwardRef(function SelectScrollUpButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton ref={ref} className={cn("flex justify-center py-1 text-muted-foreground", className)} {...props}>
      <AapmIcon name="chevronUp" />
    </SelectPrimitive.ScrollUpButton>
  );
});

const SelectScrollDownButton = React.forwardRef(function SelectScrollDownButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton ref={ref} className={cn("flex justify-center py-1 text-muted-foreground", className)} {...props}>
      <AapmIcon name="chevronDown" />
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
        className={cn("aapm-menu", className)}
        data-select="true"
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="aapm-menu__viewport">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

const SelectLabel = React.forwardRef(function SelectLabel({ className, ...props }, ref) {
  return <SelectPrimitive.Label ref={ref} className={cn("aapm-menu-label", className)} {...props} />;
});

const SelectItem = React.forwardRef(function SelectItem({ className, children, description, ...props }, ref) {
  return (
    <SelectPrimitive.Item ref={ref} className={cn("aapm-menu-item", className)} data-select="true" {...props}>
      <span className="aapm-menu-item__indicator">
        <SelectPrimitive.ItemIndicator><AapmIcon name="glyphCheck" /></SelectPrimitive.ItemIndicator>
      </span>
      <span className="min-w-0">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description ? <span className="block text-[length:var(--aapm-component-type-caption-size)] text-muted-foreground">{description}</span> : null}
      </span>
    </SelectPrimitive.Item>
  );
});

const SelectSeparator = React.forwardRef(function SelectSeparator({ className, ...props }, ref) {
  return <SelectPrimitive.Separator ref={ref} className={cn("aapm-menu-separator", className)} {...props} />;
});

/* -------------------------------------------------------------- Choices */
const Checkbox = React.forwardRef(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root ref={ref} className={cn("aapm-checkbox", className)} {...props}>
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        {props.checked === "indeterminate" ? <AapmIcon name="glyphMinus" /> : <AapmIcon name="glyphCheck" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

/**
 * Native checkbox row with label/description, for checklists that are
 * uncontrolled or form-submitted (the former T7Checkbox contract).
 */
const CheckboxField = React.forwardRef(function CheckboxField({ id, label, description, className, ...props }, ref) {
  const generated = React.useId();
  const inputId = id || generated;
  return (
    <label htmlFor={inputId} className={cn("aapm-choice-row", className)}>
      <input ref={ref} id={inputId} type="checkbox" className="aapm-checkbox" {...props} />
      <span className="min-w-0">
        <span className="block">{label}</span>
        {description ? <span className="aapm-field-hint block">{description}</span> : null}
      </span>
    </label>
  );
});

const RadioGroup = React.forwardRef(function RadioGroup({ className, ...props }, ref) {
  return <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />;
});

const RadioGroupItem = React.forwardRef(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item ref={ref} className={cn("aapm-radio", className)} {...props}>
      <RadioGroupPrimitive.Indicator className="aapm-radio__dot" />
    </RadioGroupPrimitive.Item>
  );
});

const Switch = React.forwardRef(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root ref={ref} className={cn("aapm-switch", className)} {...props}>
      <SwitchPrimitive.Thumb className="aapm-switch__thumb" />
    </SwitchPrimitive.Root>
  );
});

const Slider = React.forwardRef(function Slider({ className, ...props }, ref) {
  const thumbs = Array.isArray(props.value) ? props.value : Array.isArray(props.defaultValue) ? props.defaultValue : [0];
  return (
    <SliderPrimitive.Root ref={ref} className={cn("aapm-slider", className)} {...props}>
      <SliderPrimitive.Track className="aapm-slider__track">
        <SliderPrimitive.Range className="aapm-slider__range" />
      </SliderPrimitive.Track>
      {thumbs.map((_, index) => <SliderPrimitive.Thumb key={index} className="aapm-slider__thumb" />)}
    </SliderPrimitive.Root>
  );
});

/* ---------------------------------------------------------- Form layout */
function FormSection({ title, description, action, className, children, ...props }) {
  return (
    <section className={cn("aapm-form-section", className)} {...props}>
      {(title || description || action) ? (
        <div className="aapm-form-section__head">
          <div className="min-w-0">
            {title ? <h3 className="aapm-form-section__title">{title}</h3> : null}
            {description ? <p className="aapm-form-section__description">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function FormGrid({ columns = 2, className, style, ...props }) {
  return <div className={cn("aapm-form-grid", className)} style={{ "--form-columns": columns, ...style }} {...props} />;
}

function FormActions({ className, ...props }) {
  return <div className={cn("aapm-form-actions", className)} {...props} />;
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
  RadioGroup,
  RadioGroupItem,
  Switch,
  Slider,
  FormSection,
  FormGrid,
  FormActions,
};

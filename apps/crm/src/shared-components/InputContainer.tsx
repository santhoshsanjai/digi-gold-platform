import React, { memo } from "react";
import { Form, Tooltip } from "antd";
import type { FormItemProps, Rule } from "antd/es/form";
import type { NamePath } from "antd/es/form/interface";
import { Info } from "lucide-react";
import clsx from "clsx";
import type { Dayjs } from "dayjs";
import {
  AppCheckbox,
  AppColorPicker,
  AppDateRangePicker,
  AppDateTimePicker,
  AppInput,
  AppNumber,
  AppPassword,
  AppRadioInput,
  AppSelect,
  AppSwitch,
  AppTextarea,
  type AppSelectOption,
} from "./input-components";

export type InputType =
  | "input"
  | "email"
  | "number"
  | "password"
  | "select"
  | "multiselect"
  | "tags"
  | "checkbox"
  | "radio"
  | "date"
  | "datetime"
  | "time"
  | "rangeDate"
  | "textarea"
  | "switch"
  | "color";

export interface InputContainerProps {
  type: InputType;
  name?: NamePath;
  label?: React.ReactNode;
  tooltip?: string;
  required?: boolean;
  rules?: Rule[];
  dependencies?: NamePath[];
  placeholder?: string;
  options?: AppSelectOption[];
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  allowClear?: boolean;
  showSelectAll?: boolean;
  isToggleButton?: boolean;
  notes?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  rows?: number;
  autoFocus?: boolean;
  autoComplete?: string;
  minDate?: Dayjs;
  maxDate?: Dayjs;
  hideAsterisk?: boolean;
  /** Read and write the field outside an antd Form. */
  standalone?: boolean;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

const VALUE_PROP: Partial<Record<InputType, string>> = { checkbox: "checked", switch: "checked" };

/**
 * One field: label, validation, notes and the right input for `type`.
 *
 * Inside an antd <Form> the Form.Item supplies value and onChange; with `standalone`
 * the caller does.
 */
const InputContainer: React.FC<InputContainerProps> = (props) => {
  const {
    type,
    name,
    label,
    tooltip,
    required,
    rules = [],
    dependencies,
    className,
    notes,
    hideAsterisk = false,
    standalone = false,
  } = props;

  const field = renderField(props);
  const isRequired = required || rules.some((r) => typeof r === "object" && "required" in r && r.required);
  const labelText = typeof label === "string" ? label : "This field";

  if (standalone) {
    return (
      <div className={clsx("w-full mb-3", className)}>
        {label && type !== "checkbox" && (
          <label className="mb-1 block text-sm font-medium text-gray-600 dark:text-slate-300">
            {label}
            {isRequired && !hideAsterisk && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {field}
        {notes && <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{notes}</div>}
      </div>
    );
  }

  const itemProps: FormItemProps = {
    name,
    dependencies,
    label: type === "checkbox" ? undefined : label,
    tooltip: tooltip ? { title: tooltip, icon: <Info size={14} /> } : undefined,
    required: isRequired && !hideAsterisk,
    valuePropName: VALUE_PROP[type] ?? "value",
    rules: [
      ...(required ? [{ required: true, message: `${labelText} is required` }] : []),
      ...(type === "email" ? [{ type: "email" as const, message: "Enter a valid email" }] : []),
      ...rules,
    ],
    extra: notes ? (
      <span className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>{notes}</span>
      </span>
    ) : undefined,
  };

  return (
    <div className={className}>
      <Form.Item {...itemProps} className={type === "checkbox" ? "mb-2!" : "mb-4!"}>
        {field}
      </Form.Item>
    </div>
  );
};

function renderField(p: InputContainerProps): React.ReactNode {
  // In standalone mode the caller owns the value; inside a Form the Form.Item injects it.
  const controlled = p.standalone
    ? { value: p.value as never, onChange: p.onChange as never }
    : {};
  const common = { disabled: p.disabled, autoFocus: p.autoFocus };

  switch (p.type) {
    case "input":
    case "email":
      return (
        <AppInput
          {...common}
          {...controlled}
          {...(p.standalone ? { onChange: (e) => p.onChange?.(e.target.value) } : {})}
          type={p.type === "email" ? "email" : "text"}
          placeholder={p.placeholder}
          prefix={p.prefix}
          suffix={p.suffix}
          readOnly={p.readOnly}
          autoComplete={p.autoComplete}
        />
      );
    case "password":
      return (
        <AppPassword
          {...common}
          {...controlled}
          {...(p.standalone ? { onChange: (e) => p.onChange?.(e.target.value) } : {})}
          placeholder={p.placeholder}
          prefix={p.prefix}
          autoComplete={p.autoComplete ?? "current-password"}
        />
      );
    case "number":
      return (
        <AppNumber
          {...common}
          {...controlled}
          placeholder={p.placeholder}
          min={p.min}
          max={p.max}
          step={p.step}
          precision={p.precision}
          prefix={p.prefix}
          suffix={p.suffix}
          readOnly={p.readOnly}
        />
      );
    case "select":
    case "multiselect":
    case "tags":
      return (
        <AppSelect
          {...common}
          {...controlled}
          mode={p.type === "multiselect" ? "multiple" : p.type === "tags" ? "tags" : undefined}
          options={p.options ?? []}
          placeholder={p.placeholder}
          loading={p.loading}
          allowClear={p.allowClear ?? true}
          showSelectAll={p.showSelectAll}
        />
      );
    case "radio":
      return (
        <AppRadioInput
          {...controlled}
          disabled={p.disabled}
          options={p.options ?? []}
          isToggleButton={p.isToggleButton}
          {...(p.standalone ? { onChange: (e) => p.onChange?.(e.target.value) } : {})}
        />
      );
    case "checkbox":
      return (
        <AppCheckbox
          disabled={p.disabled}
          label={p.label}
          {...(p.standalone
            ? { checked: Boolean(p.value), onChange: (e) => p.onChange?.(e.target.checked) }
            : {})}
        />
      );
    case "switch":
      return (
        <AppSwitch
          disabled={p.disabled}
          {...(p.standalone ? { checked: Boolean(p.value), onChange: p.onChange } : {})}
        />
      );
    case "date":
    case "datetime":
      return (
        <AppDateTimePicker
          {...common}
          {...controlled}
          showTime={p.type === "datetime"}
          placeholder={p.placeholder}
          minDate={p.minDate}
          maxDate={p.maxDate}
          allowClear={p.allowClear ?? true}
        />
      );
    case "time":
      return (
        <AppDateTimePicker
          {...common}
          {...controlled}
          picker="time"
          format="hh:mm A"
          use12Hours
          placeholder={p.placeholder ?? "Select time"}
          showNow={false}
          allowClear={p.allowClear ?? false}
        />
      );
    case "rangeDate":
      return (
        <AppDateRangePicker
          {...common}
          {...controlled}
          minDate={p.minDate}
          maxDate={p.maxDate}
          allowClear={p.allowClear ?? true}
        />
      );
    case "textarea":
      return (
        <AppTextarea
          {...common}
          {...controlled}
          {...(p.standalone ? { onChange: (e) => p.onChange?.(e.target.value) } : {})}
          placeholder={p.placeholder}
          rows={p.rows}
          readOnly={p.readOnly}
        />
      );
    case "color":
      return <AppColorPicker disabled={p.disabled} {...controlled} />;
  }
}

export default memo(InputContainer);

/** A hint icon for labels outside InputContainer. */
export const HintIcon: React.FC<{ title: string }> = ({ title }) => (
  <Tooltip title={title}>
    <Info size={14} className="inline text-slate-400 ml-1 cursor-help" />
  </Tooltip>
);

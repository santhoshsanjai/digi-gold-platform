import React, { useMemo } from "react";
import { Checkbox, Divider, Select, type RefSelectProps, type SelectProps } from "antd";
import { Loader2 } from "lucide-react";

export interface AppSelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export type AppSelectProps = Omit<SelectProps, "options"> & {
  options: AppSelectOption[];
  /** Adds an "All" choice with an empty value (single select only). */
  showAllOptions?: boolean;
  /** Adds a "Select all" row (multiple select only). */
  showSelectAll?: boolean;
  ref?: React.Ref<RefSelectProps>;
};

const AppSelect: React.FC<AppSelectProps> = ({
  options,
  placeholder = "Select",
  allowClear = true,
  loading = false,
  showAllOptions = false,
  showSelectAll = false,
  showSearch = true,
  ref,
  value,
  onChange,
  ...rest
}) => {
  const isMultiple = rest.mode === "multiple" || rest.mode === "tags";
  const allValues = useMemo(() => options.map((o) => o.value), [options]);
  const selected: (string | number)[] = isMultiple && Array.isArray(value) ? value : [];
  const allSelected = allValues.length > 0 && allValues.every((v) => selected.includes(v));

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = allSelected ? [] : allValues;
    onChange?.(next, options.filter((o) => next.includes(o.value)));
  };

  return (
    <Select
      {...rest}
      ref={ref}
      value={showAllOptions && !isMultiple ? (value ?? "") : value}
      onChange={onChange}
      options={showAllOptions && !isMultiple ? [{ label: "All", value: "" }, ...options] : options}
      placeholder={placeholder}
      allowClear={allowClear}
      showSearch={showSearch}
      optionFilterProp="label"
      maxTagCount={isMultiple ? (rest.maxTagCount ?? "responsive") : undefined}
      getPopupContainer={(trigger) => trigger.parentElement || document.body}
      popupRender={
        isMultiple && showSelectAll
          ? (menu) => (
              <>
                <div
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={toggleAll}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selected.length > 0 && !allSelected}
                  />
                  <span className="text-sm font-medium">Select all</span>
                </div>
                <Divider style={{ margin: 0 }} />
                {menu}
              </>
            )
          : rest.popupRender
      }
      suffixIcon={loading ? <Loader2 className="animate-spin" size={16} /> : rest.suffixIcon}
      style={{ width: "100%", ...rest.style }}
    />
  );
};

export default AppSelect;

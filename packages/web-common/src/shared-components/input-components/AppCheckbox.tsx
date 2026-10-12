import React from "react";
import { Checkbox, type CheckboxProps } from "antd";

export interface AppCheckboxProps extends CheckboxProps {
  label?: React.ReactNode;
  isCustom?: boolean;
}

const AppCheckbox: React.FC<AppCheckboxProps> = ({ label, isCustom = false, ...rest }) =>
  isCustom ? (
    <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
      <Checkbox {...rest} />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
        {label}
      </span>
    </label>
  ) : (
    <Checkbox {...rest}>{label}</Checkbox>
  );

export default AppCheckbox;

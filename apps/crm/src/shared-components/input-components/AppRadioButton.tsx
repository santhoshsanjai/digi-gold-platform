import React from "react";
import { Radio, type RadioGroupProps } from "antd";

export interface AppRadioOption {
  label: React.ReactNode;
  value: string | number;
  disabled?: boolean;
}

export interface AppRadioInputProps extends Omit<RadioGroupProps, "options"> {
  options: AppRadioOption[];
  direction?: "horizontal" | "vertical";
  isToggleButton?: boolean;
}

const AppRadioInput: React.FC<AppRadioInputProps> = ({
  options,
  direction = "horizontal",
  isToggleButton = false,
  ...rest
}) => (
  <Radio.Group
    {...rest}
    buttonStyle="solid"
    className={
      isToggleButton
        ? ""
        : direction === "horizontal"
          ? "flex gap-3 items-center flex-wrap"
          : "flex flex-col gap-3"
    }
  >
    {options.map((opt) =>
      isToggleButton ? (
        <Radio.Button key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </Radio.Button>
      ) : (
        <Radio key={opt.value} value={opt.value} disabled={opt.disabled}>
          <span className="text-sm text-gray-800 dark:text-gray-200">{opt.label}</span>
        </Radio>
      ),
    )}
  </Radio.Group>
);

export default AppRadioInput;

import React from "react";
import { ColorPicker, type ColorPickerProps } from "antd";

export interface AppColorPickerProps extends Omit<ColorPickerProps, "value" | "onChange"> {
  value?: string;
  onChange?: (color: string) => void;
}

const AppColorPicker: React.FC<AppColorPickerProps> = ({ value, onChange, ...rest }) => (
  <ColorPicker
    {...rest}
    value={value}
    onChange={(color) => onChange?.(color.toHexString())}
    showText
  />
);

export default AppColorPicker;

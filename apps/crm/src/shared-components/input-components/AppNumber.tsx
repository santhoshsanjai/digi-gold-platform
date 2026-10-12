import React from "react";
import { InputNumber, type InputNumberProps } from "antd";

export interface AppNumberProps extends InputNumberProps<number> {
  isRightAligned?: boolean;
}

const AppNumber: React.FC<AppNumberProps> = ({ isRightAligned = true, className, ...rest }) => (
  <InputNumber<number>
    {...rest}
    controls={false}
    className={[isRightAligned ? "number-right" : "", className ?? ""].join(" ").trim()}
    style={{ width: "100%", ...rest.style }}
  />
);

export default AppNumber;

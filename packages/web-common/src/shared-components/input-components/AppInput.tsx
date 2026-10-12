import React from "react";
import { Input, type InputProps, type InputRef } from "antd";

export interface AppInputProps extends InputProps {
  ref?: React.Ref<InputRef>;
}

const AppInput: React.FC<AppInputProps> = ({ type = "text", ref, ...rest }) => (
  <Input {...rest} ref={ref} type={type} />
);

export default AppInput;

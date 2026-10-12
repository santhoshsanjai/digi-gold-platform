import React from "react";
import { Input, type InputRef } from "antd";
import type { PasswordProps } from "antd/es/input";

export interface AppPasswordProps extends PasswordProps {
  ref?: React.Ref<InputRef>;
  showPasswordToggle?: boolean;
}

const AppPassword: React.FC<AppPasswordProps> = ({ ref, showPasswordToggle = true, ...rest }) => (
  <Input.Password {...rest} ref={ref} visibilityToggle={showPasswordToggle} />
);

export default AppPassword;

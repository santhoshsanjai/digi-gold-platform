import React from "react";
import { Input } from "antd";
import type { TextAreaProps, TextAreaRef } from "antd/es/input/TextArea";

export interface AppTextareaProps extends TextAreaProps {
  ref?: React.Ref<TextAreaRef>;
}

const AppTextarea: React.FC<AppTextareaProps> = ({ ref, rows = 3, ...rest }) => (
  <Input.TextArea {...rest} ref={ref} rows={rows} />
);

export default AppTextarea;

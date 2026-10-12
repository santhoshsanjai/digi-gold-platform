import React from "react";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { RangePickerProps } from "antd/es/date-picker";

type RangeValue = [Dayjs | string | null, Dayjs | string | null] | null;

export type AppDateRangePickerProps = Omit<RangePickerProps, "value" | "onChange"> & {
  value?: RangeValue;
  onChange?: (dates: [Dayjs | null, Dayjs | null] | null) => void;
};

const AppDateRangePicker: React.FC<AppDateRangePickerProps> = ({
  value,
  onChange,
  format,
  ...rest
}) => {
  const val: [Dayjs | null, Dayjs | null] | null =
    value && (value[0] || value[1])
      ? [value[0] ? dayjs(value[0]) : null, value[1] ? dayjs(value[1]) : null]
      : null;

  return (
    <DatePicker.RangePicker
      {...rest}
      value={val}
      onChange={(dates) => onChange?.(dates)}
      style={{ width: "100%" }}
      format={format || "DD MMM YYYY"}
      separator={<span className="text-gray-500 text-sm font-medium">to</span>}
    />
  );
};

export default AppDateRangePicker;

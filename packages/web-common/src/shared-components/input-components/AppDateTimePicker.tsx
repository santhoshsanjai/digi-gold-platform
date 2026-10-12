import React from "react";
import { DatePicker, type DatePickerProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";

export type AppDateTimePickerProps = Omit<DatePickerProps, "value" | "onChange"> & {
  /** A Dayjs, an ISO string or null. */
  value?: Dayjs | string | null;
  onChange?: (date: Dayjs | null) => void;
  showTime?: boolean;
};

const AppDateTimePicker: React.FC<AppDateTimePickerProps> = ({
  value,
  onChange,
  showTime = false,
  picker = "date",
  needConfirm = false,
  placeholder,
  format,
  ...rest
}) => (
  <DatePicker
    getPopupContainer={(trigger) => trigger.parentElement || document.body}
    {...rest}
    value={value ? dayjs(value) : null}
    onChange={(date) => onChange?.(Array.isArray(date) ? (date[0] ?? null) : date)}
    showTime={showTime}
    style={{ width: "100%" }}
    format={
      format ??
      (picker === "month"
        ? "MMMM YYYY"
        : picker === "time"
          ? "hh:mm A"
          : picker === "year"
            ? "YYYY"
            : showTime
              ? "DD MMM YYYY hh:mm A"
              : "DD MMM YYYY")
    }
    picker={picker}
    needConfirm={needConfirm}
    placeholder={placeholder ?? (showTime ? "Select date and time" : "Select date")}
  />
);

export default AppDateTimePicker;

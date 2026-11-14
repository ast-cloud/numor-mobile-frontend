// Form fields built on the primitives: date picker field, floating-label select, data table.
import React, { useRef, useState } from "react";
import { ScrollView } from "react-native";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react-native";
import { Calendar } from "./calendar";
import { Popper, Select, SelectOption } from "./popper";
import { Box, Icon, Press, Txt, ViewRef } from "./primitives";

const parseYmd = (v?: string) => {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};

/**
 * Stand-in for <input type="date">: shows the date in the device's locale and opens the
 * app calendar. `value` / `onChange` use the same YYYY-MM-DD strings as the web inputs.
 */
export function DateField({
  value,
  onChange,
  label,
  className,
  disabled,
  placeholder = "Pick a date",
}: {
  value?: string;
  onChange: (v: string) => void;
  /** floating label (web: FloatingLabelInput type="date") */
  label?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<ViewRef>(null);
  const [open, setOpen] = useState(false);
  const date = parseYmd(value);
  const text = date ? date.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  return (
    <>
      <Press
        ref={ref}
        disabled={disabled}
        activeOpacity={1}
        onPress={() => setOpen(true)}
        className={`h-10 w-full flex-row items-center justify-between rounded-md border border-input bg-background px-3 ${label ? "pt-4 pb-1" : ""} ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
      >
        {label ? (
          <Box pointerEvents="none" className="absolute left-3 top-1">
            <Txt className="text-[10px] leading-[15px] font-medium text-muted-foreground">{label}</Txt>
          </Box>
        ) : null}
        <Txt className={`text-sm ${text ? "" : "text-muted-foreground"}`}>{text || placeholder}</Txt>
        <Icon as={CalendarIcon} className="h-4 w-4" />
      </Press>
      <Popper open={open} onClose={() => setOpen(false)} anchorRef={ref} align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </Popper>
    </>
  );
}

/** Select whose label floats above the value (bill form on web). */
export function FloatingSelect({
  label,
  value,
  onValueChange,
  options,
  disabled,
}: {
  label: string;
  value?: string;
  onValueChange: (v: string) => void;
  options: (SelectOption | string)[];
  disabled?: boolean;
}) {
  return (
    <Box className="relative">
      <Select value={value} onValueChange={onValueChange} options={options} disabled={disabled} placeholder=" " className="pt-4 pb-1" />
      <Box pointerEvents="none" className={`absolute left-3 ${value ? "top-1" : "top-0 bottom-0 justify-center"}`}>
        <Txt className={value ? "text-[10px] leading-[15px] font-medium text-muted-foreground" : "text-sm text-muted-foreground"}>{label}</Txt>
      </Box>
    </Box>
  );
}

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width: number;
  align?: "left" | "right" | "center";
  /** classes for the body cell text */
  className?: string;
  render: (row: T, index: number) => React.ReactNode;
}

/**
 * Data table. Like the web table inside its overflow-auto wrapper, it keeps its column
 * widths and scrolls sideways when the screen is narrower than the table.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowPress,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowPress?: (row: T) => void;
  footer?: React.ReactNode;
}) {
  const [avail, setAvail] = useState(0);
  const natural = columns.reduce((s, c) => s + c.width, 0);
  // Stretch columns proportionally when there is spare room (table width: 100%).
  const scale = avail > natural ? avail / natural : 1;
  const alignCls = (a?: string) => (a === "right" ? "items-end" : a === "center" ? "items-center" : "items-start");
  const textAlign = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  const cell = (node: React.ReactNode, cls: string) =>
    typeof node === "string" || typeof node === "number" ? <Txt className={cls}>{node}</Txt> : node;
  return (
    <Box onLayout={(e) => setAvail(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <Box style={{ width: Math.max(natural * scale, avail) }}>
          <Box className="flex-row border-b border-border">
            {columns.map((c) => (
              <Box key={c.key} className={`min-h-12 justify-center px-4 ${alignCls(c.align)}`} style={{ width: c.width * scale }}>
                {cell(c.header, `text-sm font-medium text-muted-foreground ${textAlign(c.align)}`)}
              </Box>
            ))}
          </Box>
          {rows.map((row, i) => {
            const content = columns.map((c) => (
              <Box key={c.key} className={`justify-center p-4 ${alignCls(c.align)}`} style={{ width: c.width * scale }}>
                {cell(c.render(row, i), `text-sm ${textAlign(c.align)} ${c.className ?? ""}`)}
              </Box>
            ));
            const cls = `flex-row ${i === rows.length - 1 ? "" : "border-b border-border"}`;
            return onRowPress ? (
              <Press key={rowKey(row, i)} className={cls} activeClassName="bg-muted/50" onPress={() => onRowPress(row)}>
                {content}
              </Press>
            ) : (
              <Box key={rowKey(row, i)} className={cls}>
                {content}
              </Box>
            );
          })}
          {footer}
        </Box>
      </ScrollView>
    </Box>
  );
}

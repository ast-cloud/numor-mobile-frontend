// Month calendar matching the web app's shadcn Calendar (react-day-picker) styling.
import React, { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Box, Icon, Press, Txt } from "./primitives";

export type DateRange = { from?: Date; to?: Date };

type CommonProps = {
  defaultMonth?: Date;
  numberOfMonths?: number;
  disabled?: (date: Date) => boolean;
  className?: string;
};
type SingleProps = CommonProps & { mode?: "single"; selected?: Date; onSelect?: (d: Date | undefined) => void };
type RangeProps = CommonProps & { mode: "range"; selected?: DateRange; onSelect?: (r: DateRange | undefined) => void };

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CELL = 36;

export function Calendar(props: SingleProps | RangeProps) {
  const { numberOfMonths = 1, disabled, className } = props;
  const initial =
    props.defaultMonth ??
    (props.mode === "range" ? props.selected?.from : (props.selected as Date | undefined)) ??
    new Date();
  const [month, setMonth] = useState(startOfMonth(initial));
  const today = startOfDay(new Date());

  const handlePress = (day: Date) => {
    if (props.mode === "range") {
      const cur = props.selected;
      if (!cur?.from || (cur.from && cur.to)) props.onSelect?.({ from: day, to: undefined });
      else if (isBefore(day, cur.from)) props.onSelect?.({ from: day, to: cur.from });
      else props.onSelect?.({ from: cur.from, to: day });
    } else {
      const cur = props.selected as Date | undefined;
      props.onSelect?.(cur && isSameDay(cur, day) ? undefined : day);
    }
  };

  const months = useMemo(() => Array.from({ length: numberOfMonths }, (_, i) => addMonths(month, i)), [month, numberOfMonths]);

  return (
    <Box className={`p-3 gap-4 ${className ?? ""}`} style={{ width: CELL * 7 + 24 }}>
      {months.map((m, idx) => {
        const start = startOfWeek(startOfMonth(m));
        const end = endOfWeek(endOfMonth(m));
        const weeks: Date[][] = [];
        for (let d = start; !isAfter(d, end); d = addDays(d, 7)) {
          weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
        }
        return (
          <Box key={m.toISOString()} className="gap-4">
            <Box className="h-9 flex-row items-center justify-center pt-1">
              <Txt className="text-sm font-medium">{format(m, "MMMM yyyy")}</Txt>
              {idx === 0 && (
                <Box className="absolute inset-x-0 top-0 flex-row items-center justify-between px-1" pointerEvents="box-none">
                  <Press
                    onPress={() => setMonth(addMonths(month, -1))}
                    hitSlop={8}
                    className="h-7 w-7 items-center justify-center rounded-lg border border-border opacity-50"
                    accessibilityLabel="Previous month"
                  >
                    <Icon as={ChevronLeft} className="h-4 w-4" />
                  </Press>
                  <Press
                    onPress={() => setMonth(addMonths(month, 1))}
                    hitSlop={8}
                    className="h-7 w-7 items-center justify-center rounded-lg border border-border opacity-50"
                    accessibilityLabel="Next month"
                  >
                    <Icon as={ChevronRight} className="h-4 w-4" />
                  </Press>
                </Box>
              )}
            </Box>
            <Box>
              <Box className="flex-row">
                {WEEKDAYS.map((w) => (
                  <Txt key={w} className="flex-1 text-center text-[12.8px] leading-5 text-muted-foreground">
                    {w}
                  </Txt>
                ))}
              </Box>
              {weeks.map((week) => (
                <Box key={week[0].toISOString()} className="mt-2 flex-row">
                  {week.map((day) => {
                    const outside = !isSameMonth(day, m);
                    const isDisabled = disabled?.(day) ?? false;
                    let selected = false;
                    let rangeMiddle = false;
                    let rangeStart = false;
                    let rangeEnd = false;
                    if (props.mode === "range") {
                      const r = props.selected;
                      if (r?.from && isSameDay(day, r.from)) rangeStart = selected = true;
                      if (r?.to && isSameDay(day, r.to)) rangeEnd = selected = true;
                      if (r?.from && r?.to && isAfter(day, r.from) && isBefore(day, r.to)) rangeMiddle = true;
                    } else {
                      const s = props.selected as Date | undefined;
                      selected = !!s && isSameDay(s, day);
                    }
                    const isToday = isSameDay(day, today);
                    const hasRange = props.mode === "range" && !!props.selected?.from && !!props.selected?.to;
                    const bg = selected ? "bg-primary" : rangeMiddle || isToday ? "bg-accent" : "";
                    const fg =
                      selected ? "text-primary-foreground" : rangeMiddle || isToday ? "text-accent-foreground" : outside || isDisabled ? "text-muted-foreground" : "";
                    const round = rangeMiddle
                      ? "rounded-none"
                      : hasRange && rangeStart && !rangeEnd
                        ? "rounded-l-lg"
                        : hasRange && rangeEnd && !rangeStart
                          ? "rounded-r-lg"
                          : "rounded-lg";
                    return (
                      <Box key={day.toISOString()} className="flex-1 items-center justify-center" style={{ height: CELL }}>
                        <Press
                          disabled={isDisabled}
                          onPress={() => handlePress(day)}
                          className={`h-9 w-9 items-center justify-center ${round} ${bg} ${(outside || isDisabled) && !selected ? "opacity-50" : ""}`}
                        >
                          <Txt className={`text-sm ${fg}`}>{format(day, "d")}</Txt>
                        </Press>
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

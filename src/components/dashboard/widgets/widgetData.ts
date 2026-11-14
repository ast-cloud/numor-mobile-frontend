import type { DateRange } from "@/components/ui/calendar";

export type TimeRangePreset = "all" | "today" | "this_week" | "this_month" | "this_quarter" | "custom";

export interface TimeRangeConfig {
  preset: TimeRangePreset;
  customRange?: DateRange;
}

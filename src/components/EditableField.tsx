import React from "react";
import { LucideIcon } from "lucide-react-native";
import { Box, Icon, Input, InputProps, Select, SelectOption, Txt } from "@/components/ui";

/** Small label with an optional leading icon (web: <Label className="flex items-center gap-2 text-xs">). */
export const FieldLabel = ({ icon, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) => (
  <Box className="flex-row items-center gap-2">
    {icon && <Icon as={icon} className="w-3 h-3 text-muted-foreground" />}
    <Txt className={`text-xs font-medium ${icon ? "leading-4" : "leading-6"} ${className ?? ""}`}>{children}</Txt>
  </Box>
);

/** Read-only value pill shown when a card is not being edited. */
export const ReadValue = ({ children }: { children: React.ReactNode }) => (
  <Box className="py-1.5 px-3 bg-muted/50 rounded-md">
    <Txt className="text-sm">{children || "Not set"}</Txt>
  </Box>
);

/** Label + compact input while editing, label + read-only pill otherwise. */
export function EditableField({
  label,
  icon,
  value,
  editing,
  onChange,
  options,
  selectPlaceholder,
  ...input
}: {
  label: string;
  icon?: LucideIcon;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  /** render a select instead of a text input */
  options?: (SelectOption | string)[];
  selectPlaceholder?: string;
} & Omit<InputProps, "value" | "onChange" | "onChangeText">) {
  const display = options ? (options.find((o) => typeof o !== "string" && o.value === value) as SelectOption | undefined)?.label ?? value : value;
  return (
    <Box className="gap-2">
      <FieldLabel icon={icon}>{label}</FieldLabel>
      {editing ? (
        options ? (
          <Select value={value} onValueChange={onChange} options={options} placeholder={selectPlaceholder} className="h-8" />
        ) : (
          <Input value={value} onChangeText={onChange} className="h-8 text-sm" {...input} />
        )
      ) : (
        <ReadValue>{display}</ReadValue>
      )}
    </Box>
  );
}

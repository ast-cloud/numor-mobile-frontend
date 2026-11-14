// Anchored floating layers: Popover, Select and DropdownMenu (Radix look, pure JS).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronRight, LucideIcon } from "lucide-react-native";
import { useTheme } from "@/hooks/use-theme";
import { Portal } from "./portal";
import { Box, Icon, Press, Txt, ViewRef } from "./primitives";

type Rect = { x: number; y: number; width: number; height: number };

interface PopperProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<ViewRef | null>;
  align?: "start" | "center" | "end";
  /** make the layer at least as wide as the trigger */
  matchWidth?: boolean;
  sideOffset?: number;
  className?: string;
  children: React.ReactNode;
}

export function Popper({ open, onClose, anchorRef, align = "start", matchWidth, sideOffset = 4, className, children }: PopperProps) {
  const { tw } = useTheme();
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      setSize(null);
      return;
    }
    anchorRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, anchorRef, onClose]);

  if (!open || !anchor) return null;

  const margin = 8;
  const spaceBelow = win.height - insets.bottom - (anchor.y + anchor.height) - sideOffset - margin;
  const spaceAbove = anchor.y - insets.top - sideOffset - margin;
  const placeAbove = !!size && size.height > spaceBelow && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, placeAbove ? spaceAbove : spaceBelow);

  let left = anchor.x;
  if (size) {
    if (align === "end") left = anchor.x + anchor.width - size.width;
    if (align === "center") left = anchor.x + anchor.width / 2 - size.width / 2;
    left = Math.max(margin, Math.min(left, win.width - size.width - margin));
  }
  const top = placeAbove && size ? anchor.y - sideOffset - Math.min(size.height, maxHeight) : anchor.y + anchor.height + sideOffset;

  return (
    <Portal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
      <View
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        style={[
          tw.style(`absolute rounded-md border border-border bg-popover shadow-md ${className ?? ""}`),
          {
            top,
            left,
            maxHeight,
            maxWidth: win.width - margin * 2,
            minWidth: matchWidth ? anchor.width : 128,
            opacity: size ? 1 : 0,
          },
        ]}
      >
        {children}
      </View>
    </Portal>
  );
}

/* --------------------------------------------------------------- Popover */

export function Popover({
  trigger,
  children,
  align = "center",
  className,
  open: controlledOpen,
  onOpenChange,
}: {
  /** render the trigger; call `toggle` on press and attach `ref` to the pressable */
  trigger: (p: { ref: React.RefObject<ViewRef | null>; toggle: () => void; open: boolean }) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "center" | "end";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const ref = useRef<ViewRef>(null);
  const [inner, setInner] = useState(false);
  const open = controlledOpen ?? inner;
  const setOpen = useCallback(
    (v: boolean) => {
      setInner(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  return (
    <>
      {trigger({ ref, toggle: () => setOpen(!open), open })}
      <Popper open={open} onClose={close} anchorRef={ref} align={align} className={className ?? "w-72 p-4"}>
        {typeof children === "function" ? children(close) : children}
      </Popper>
    </>
  );
}

/* ---------------------------------------------------------------- Select */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  textClassName,
  contentClassName,
  renderValue,
  footer,
}: {
  value?: string;
  onValueChange: (v: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  disabled?: boolean;
  /** trigger classes */
  className?: string;
  textClassName?: string;
  contentClassName?: string;
  renderValue?: (opt: SelectOption | undefined) => React.ReactNode;
  /** extra content under the options (e.g. an "Add new" row); receives close() */
  footer?: (close: () => void) => React.ReactNode;
}) {
  const ref = useRef<ViewRef>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const opts: SelectOption[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = opts.find((o) => o.value === value);

  return (
    <>
      <Press
        ref={ref}
        disabled={disabled}
        activeOpacity={1}
        accessibilityRole="combobox"
        onPress={() => setOpen(true)}
        className={`h-10 w-full flex-row items-center justify-between rounded-md border border-input bg-background px-3 ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
      >
        {renderValue ? (
          renderValue(selected)
        ) : (
          <Txt numberOfLines={1} className={`flex-1 text-sm ${selected ? "" : "text-muted-foreground"} ${textClassName ?? ""}`}>
            {selected ? selected.label : (placeholder ?? "")}
          </Txt>
        )}
        <Icon as={ChevronDown} className="h-4 w-4 text-foreground/50" />
      </Press>
      <Popper open={open} onClose={close} anchorRef={ref} matchWidth className={contentClassName}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 384 }} contentContainerStyle={{ padding: 4 }}>
          {opts.map((o) => (
            <Press
              key={o.value}
              disabled={o.disabled}
              onPress={() => {
                onValueChange(o.value);
                close();
              }}
              activeClassName="bg-accent/15"
              className={`flex-row items-center rounded-sm py-1.5 pl-8 pr-2 ${o.disabled ? "opacity-50" : ""}`}
            >
              {o.value === value && (
                <Box className="absolute left-2 h-3.5 w-3.5 items-center justify-center">
                  <Icon as={Check} className="h-4 w-4" />
                </Box>
              )}
              <Txt className="text-sm">{o.label}</Txt>
            </Press>
          ))}
          {footer?.(close)}
        </ScrollView>
      </Popper>
    </>
  );
}

/* ---------------------------------------------------------- DropdownMenu */

export type MenuItem =
  | {
      label: string;
      icon?: LucideIcon;
      onPress?: () => void;
      destructive?: boolean;
      disabled?: boolean;
      /** show a check mark (checkbox item) */
      checked?: boolean;
      /** keep the menu open after pressing */
      keepOpen?: boolean;
      /** nested items (web: DropdownMenuSub); they replace the list when this row is pressed */
      submenu?: MenuItem[];
    }
  | { separator: true }
  | { heading: string };

export function DropdownMenu({
  trigger,
  items,
  align = "end",
  className,
}: {
  trigger: (p: { ref: React.RefObject<ViewRef | null>; open: () => void; isOpen: boolean }) => React.ReactNode;
  items: MenuItem[];
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const ref = useRef<ViewRef>(null);
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<MenuItem[] | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setSub(null);
  }, []);
  const shown = sub ?? items;
  const hasChecks = shown.some((i) => "checked" in i && i.checked !== undefined);
  return (
    <>
      {trigger({ ref, open: () => setOpen(true), isOpen: open })}
      <Popper open={open} onClose={close} anchorRef={ref} align={align} className={`shadow-lg ${className ?? ""}`}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 4 }}>
          {shown.map((item, i) => {
            if ("separator" in item) return <Box key={i} className="-mx-1 my-1 h-px bg-muted" />;
            if ("heading" in item)
              return (
                <Txt key={i} className="px-2 py-1.5 text-sm font-semibold">
                  {item.heading}
                </Txt>
              );
            return (
              <Press
                key={i}
                disabled={item.disabled}
                onPress={() => {
                  if (item.submenu) {
                    setSub(item.submenu);
                    return;
                  }
                  if (!item.keepOpen) close();
                  item.onPress?.();
                }}
                activeClassName="bg-accent/15"
                className={`flex-row items-center rounded-sm py-1.5 pr-2 ${hasChecks ? "pl-8" : "pl-2"} ${item.disabled ? "opacity-50" : ""}`}
              >
                {item.checked && (
                  <Box className="absolute left-2 h-3.5 w-3.5 items-center justify-center">
                    <Icon as={Check} className="h-4 w-4" />
                  </Box>
                )}
                {item.icon && <Icon as={item.icon} className={`mr-2 h-4 w-4 ${item.destructive ? "text-destructive" : ""}`} />}
                <Txt className={`text-sm ${item.destructive ? "text-destructive" : ""}`}>{item.label}</Txt>
                {item.submenu && <Icon as={ChevronRight} className="ml-auto h-4 w-4" />}
              </Press>
            );
          })}
        </ScrollView>
      </Popper>
    </>
  );
}

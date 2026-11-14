// Card, Badge, Separator, Skeleton, Progress, Switch, Checkbox, Tabs
import React, { createContext, useContext, useEffect, useRef } from "react";
import { Animated, Platform } from "react-native";
import { Check } from "lucide-react-native";
import { useTheme } from "@/hooks/use-theme";
import { Box, BoxProps, ContentColorContext, Icon, Press, Txt, TxtProps } from "./primitives";

/* ------------------------------------------------------------------ Card */

export const Card = ({ className, ...p }: BoxProps) => (
  <Box className={`rounded-lg bg-card shadow-sm ${className ?? ""}`} {...p} />
);
export const CardHeader = ({ className, ...p }: BoxProps) => <Box className={`gap-1.5 p-6 ${className ?? ""}`} {...p} />;
export const CardTitle = ({ className, ...p }: TxtProps) => (
  <Txt className={`font-display text-2xl leading-6 font-semibold tracking-tight ${className ?? ""}`} {...p} />
);
export const CardDescription = ({ className, ...p }: TxtProps) => (
  <Txt className={`text-sm text-muted-foreground ${className ?? ""}`} {...p} />
);
export const CardContent = ({ className, ...p }: BoxProps) => <Box className={`p-6 pt-0 ${className ?? ""}`} {...p} />;
export const CardFooter = ({ className, ...p }: BoxProps) => (
  <Box className={`flex-row items-center p-6 pt-0 ${className ?? ""}`} {...p} />
);

/* ----------------------------------------------------------------- Badge */

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function Badge({
  variant = "default",
  className,
  textClassName,
  color,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  textClassName?: string;
  color?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const bg = {
    default: "border-transparent bg-primary",
    secondary: "border-transparent bg-secondary",
    destructive: "border-transparent bg-destructive",
    outline: "",
  }[variant];
  const fg =
    color ??
    {
      default: colors["primary-foreground"],
      secondary: colors["secondary-foreground"],
      destructive: colors["destructive-foreground"],
      outline: colors.foreground,
    }[variant];
  return (
    <Box className={`flex-row items-center self-start rounded-full border px-2.5 py-0.5 ${bg} ${className ?? ""}`}>
      <ContentColorContext.Provider value={fg}>
        {React.Children.map(children, (child) =>
          typeof child === "string" || typeof child === "number" ? (
            <Txt className={`text-xs font-semibold ${textClassName ?? ""}`}>{child}</Txt>
          ) : (
            child
          ),
        )}
      </ContentColorContext.Provider>
    </Box>
  );
}

/* ------------------------------------------------------------- Separator */

export const Separator = ({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) => (
  <Box className={`bg-border ${orientation === "horizontal" ? "h-px w-full" : "h-full w-px"} ${className ?? ""}`} />
);

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  const { tw } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 1000, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[tw.style(`rounded-md bg-muted ${className ?? ""}`), { opacity }]} />;
}

/* -------------------------------------------------------------- Progress */

export const Progress = ({ value = 0, className }: { value?: number; className?: string }) => (
  <Box className={`h-4 w-full overflow-hidden rounded-full bg-secondary ${className ?? ""}`}>
    <Box className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </Box>
);

/* ---------------------------------------------------------------- Switch */

export function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { tw, colors } = useTheme();
  const x = useRef(new Animated.Value(checked ? 20 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: checked ? 20 : 0, duration: 150, useNativeDriver: Platform.OS !== "web" }).start();
  }, [checked, x]);
  return (
    <Press
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      activeOpacity={1}
      onPress={() => onCheckedChange?.(!checked)}
      hitSlop={8}
      className={`h-6 w-11 justify-center rounded-full border-2 border-transparent ${disabled ? "opacity-50" : ""}`}
      style={{ backgroundColor: checked ? colors.primary : colors.input }}
    >
      <Animated.View style={[tw.style("h-5 w-5 rounded-full bg-background shadow-lg"), { transform: [{ translateX: x }] }]} />
    </Press>
  );
}

/* -------------------------------------------------------------- Checkbox */

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Press
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      activeOpacity={1}
      hitSlop={10}
      onPress={() => onCheckedChange?.(!checked)}
      className={`h-4 w-4 items-center justify-center rounded-sm border border-primary ${checked ? "bg-primary" : ""} ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      {checked ? <Icon as={Check} size={14} className="text-primary-foreground" strokeWidth={2.5} /> : null}
    </Press>
  );
}

/* ------------------------------------------------------------------ Tabs */

const TabsContext = createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);

export function Tabs({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <Box className={className}>{children}</Box>
    </TabsContext.Provider>
  );
}

export const TabsList = ({ className, ...p }: BoxProps) => (
  <Box className={`h-10 flex-row items-center justify-center self-start rounded-md bg-muted p-1 ${className ?? ""}`} {...p} />
);

export function TabsTrigger({
  value,
  className,
  textClassName,
  children,
}: {
  value: string;
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(TabsContext)!;
  const { colors } = useTheme();
  const active = ctx.value === value;
  return (
    <Press
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      activeOpacity={1}
      onPress={() => ctx.onValueChange(value)}
      className={`flex-row items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 ${active ? "bg-background shadow-sm" : ""} ${className ?? ""}`}
    >
      <ContentColorContext.Provider value={active ? colors.foreground : colors["muted-foreground"]}>
        {React.Children.map(children, (child) =>
          typeof child === "string" || typeof child === "number" ? (
            <Txt numberOfLines={1} className={`text-sm font-medium ${textClassName ?? ""}`}>
              {child}
            </Txt>
          ) : (
            child
          ),
        )}
      </ContentColorContext.Provider>
    </Press>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <Box className={`mt-2 ${className ?? ""}`}>{children}</Box>;
}

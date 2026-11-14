import React from "react";
import { GestureResponderEvent, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { ContentColorContext, ForcedIconSizeContext, Press, Txt } from "./primitives";

type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "hero" | "heroOutline";
type Size = "default" | "sm" | "lg" | "xl" | "icon";

const containerVariants: Record<Variant, string> = {
  default: "bg-primary",
  destructive: "bg-destructive",
  outline: "border border-border bg-transparent",
  secondary: "bg-secondary",
  ghost: "",
  link: "",
  hero: "bg-primary",
  heroOutline: "border-2 border-primary/50 bg-transparent",
};

const pressedVariants: Record<Variant, string> = {
  default: "bg-primary/90",
  destructive: "bg-destructive/90",
  outline: "bg-secondary border-primary/50",
  secondary: "bg-secondary/80",
  ghost: "bg-secondary",
  link: "opacity-70",
  hero: "bg-primary/90",
  heroOutline: "bg-primary/10 border-primary",
};

const textColor = (v: Variant, c: Record<string, string>) =>
  ({
    default: c["primary-foreground"],
    destructive: c["destructive-foreground"],
    outline: c.foreground,
    secondary: c["secondary-foreground"],
    ghost: c.foreground,
    link: c.primary,
    hero: c["primary-foreground"],
    heroOutline: c.foreground,
  })[v];

const sizeVariants: Record<Size, string> = {
  default: "h-10 px-4 rounded-lg",
  sm: "h-9 px-3 rounded-md",
  lg: "h-12 px-8 rounded-xl",
  xl: "h-14 px-10 rounded-xl",
  icon: "h-10 w-10 rounded-lg",
};

const textSize: Record<Size, string> = {
  default: "text-sm",
  sm: "text-sm",
  lg: "text-base",
  xl: "text-lg",
  icon: "text-sm",
};

export interface ButtonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  /** classes for the label text (e.g. text-xs) */
  textClassName?: string;
  /** overrides the label/icon colour */
  color?: string;
  disabled?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  hitSlop?: number;
}

export const Button = React.forwardRef<any, ButtonProps>(
  (
    { variant = "default", size = "default", className, textClassName, color, disabled, onPress, children, style, ...rest },
    ref,
  ) => {
    const { colors } = useTheme();
    const fg = color ?? textColor(variant, colors as unknown as Record<string, string>);
    const weight = variant === "hero" ? "font-semibold" : "font-medium";
    return (
      <Press
        ref={ref}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        className={`flex-row items-center justify-center gap-2 ${sizeVariants[size]} ${containerVariants[variant]} ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
        activeClassName={pressedVariants[variant]}
        style={style}
        {...rest}
      >
        <ContentColorContext.Provider value={fg}>
         <ForcedIconSizeContext.Provider value={16}>
          {React.Children.map(children, (child) =>
            typeof child === "string" || typeof child === "number" ? (
              <Txt
                numberOfLines={1}
                className={`${textSize[size]} ${weight} ${variant === "link" ? "underline" : ""} ${textClassName ?? ""}`}
              >
                {child}
              </Txt>
            ) : (
              child
            ),
          )}
         </ForcedIconSizeContext.Provider>
        </ContentColorContext.Provider>
      </Press>
    );
  },
);
Button.displayName = "Button";

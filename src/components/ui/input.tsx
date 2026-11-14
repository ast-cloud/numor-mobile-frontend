import React, { useState } from "react";
import { Platform, StyleSheet, TextInput, TextInputProps, TextStyle } from "react-native";

export type InputRef = React.ComponentRef<typeof TextInput>;
import { useTheme } from "@/hooks/use-theme";
import { Box, Txt, resolveFont } from "./primitives";

export type InputProps = TextInputProps & {
  className?: string;
  disabled?: boolean;
  /** web-style input type */
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
};

const typeProps = (type?: InputProps["type"]): Partial<TextInputProps> => {
  switch (type) {
    case "email":
      return { keyboardType: "email-address", autoCapitalize: "none", autoCorrect: false, autoComplete: "email" };
    case "password":
      return { secureTextEntry: true, autoCapitalize: "none", autoCorrect: false };
    case "number":
      return { keyboardType: "decimal-pad" };
    case "tel":
      return { keyboardType: "phone-pad" };
    case "url":
      return { keyboardType: "url", autoCapitalize: "none", autoCorrect: false };
    default:
      return {};
  }
};

/** The web focus ring: 2px page-coloured gap, then a 1px ring in the brand colour. */
export const useFocusRing = () => {
  const { colors } = useTheme();
  return { boxShadow: `0px 0px 0px 2px ${colors.background}, 0px 0px 0px 3px ${colors.ring}` } as any;
};

export const Input = React.forwardRef<InputRef, InputProps>(
  ({ className, style, disabled, editable, type, onFocus, onBlur, ...props }, ref) => {
    const { tw, colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const ring = useFocusRing();
    const isDisabled = disabled || editable === false;
    const flat = resolveFont(
      StyleSheet.flatten([
        // Mobile web uses text-base (16px) for inputs.
        tw.style("h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground"),
        { paddingVertical: 0, lineHeight: undefined },
        className ? tw.style(className) : null,
        isDisabled ? { opacity: 0.5 } : null,
        focused ? ring : null,
        Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null,
        style,
      ]) as TextStyle,
    );
    delete flat.lineHeight;
    if (Platform.OS === "android") flat.includeFontPadding = false;
    return (
      <TextInput
        ref={ref}
        allowFontScaling={false}
        editable={!isDisabled}
        placeholderTextColor={colors["muted-foreground"]}
        selectionColor={colors.primary}
        underlineColorAndroid="transparent"
        {...typeProps(type)}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={flat}
      />
    );
  },
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<InputRef, InputProps>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    multiline
    textAlignVertical="top"
    className={`h-auto min-h-[80px] py-2 text-sm ${className ?? ""}`}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/** Input whose label floats to the top when focused or filled (web: FloatingLabelInput). */
export const FloatingLabelInput = React.forwardRef<InputRef, InputProps & { label: string }>(
  ({ label, className, value, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const hasValue = value !== undefined && value !== "";
    const floating = focused || hasValue;
    return (
      <Box className="relative">
        <Input
          ref={ref}
          value={value}
          className={`text-sm pt-4 pb-1 ${className ?? ""}`}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <Box pointerEvents="none" className={`absolute left-3 ${floating ? "top-1" : "top-0 bottom-0 justify-center"}`}>
          <Txt className={floating ? "text-[10px] leading-[15px] font-medium text-muted-foreground" : "text-sm text-muted-foreground"}>
            {label}
          </Txt>
        </Box>
      </Box>
    );
  },
);
FloatingLabelInput.displayName = "FloatingLabelInput";

/**
 * Form label. On the web a <label> is inline, so inside a normal block it occupies a full
 * 24px line; inside a flex row it shrinks to its own line height. Pass `tight` for the latter.
 */
export function Label({ className, tight, children }: { className?: string; tight?: boolean; children: React.ReactNode }) {
  const leading = tight ? (className?.includes("text-xs") ? "leading-4" : "leading-[14px]") : "leading-6";
  return <Txt className={`text-sm font-medium ${className ?? ""} ${leading}`}>{children}</Txt>;
}

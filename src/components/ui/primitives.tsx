// Core building blocks. They accept the same Tailwind class names the web app uses,
// resolved against the Numor theme, so screens can be ported class-for-class.
import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { Loader2, LucideIcon } from "lucide-react-native";
import { useTheme } from "@/hooks/use-theme";

export type ViewRef = React.ComponentRef<typeof View>;

/* ------------------------------------------------------------------ fonts */

const FONT_FILES: Record<string, Record<string, string>> = {
  Inter: {
    "300": "Inter_300Light",
    "400": "Inter_400Regular",
    "500": "Inter_500Medium",
    "600": "Inter_600SemiBold",
    "700": "Inter_700Bold",
    "800": "Inter_800ExtraBold",
  },
  SpaceGrotesk: {
    "300": "SpaceGrotesk_400Regular",
    "400": "SpaceGrotesk_400Regular",
    "500": "SpaceGrotesk_500Medium",
    "600": "SpaceGrotesk_600SemiBold",
    "700": "SpaceGrotesk_700Bold",
    "800": "SpaceGrotesk_700Bold",
  },
};

/**
 * Custom fonts are loaded one file per weight, so map (family, weight) to the exact
 * font file. This is what keeps text identical on iOS and Android (no synthetic bold).
 */
export function resolveFont(style: TextStyle): Record<string, any> {
  const family = style.fontFamily === "SpaceGrotesk" ? "SpaceGrotesk" : "Inter";
  let weight = String(style.fontWeight ?? "400");
  if (weight === "bold") weight = "700";
  if (weight === "normal") weight = "400";
  const file = FONT_FILES[family][weight] ?? FONT_FILES[family]["400"];
  return { ...style, fontFamily: file, fontWeight: undefined };
}

/* ------------------------------------------------------------------- Box */

export type BoxProps = ViewProps & { className?: string };

export const Box = React.forwardRef<ViewRef, BoxProps>(({ className, style, ...props }, ref) => {
  const { tw, colors } = useTheme();
  return (
    <View
      ref={ref}
      style={[{ borderColor: colors.border }, className ? tw.style(className) : null, style]}
      {...props}
    />
  );
});
Box.displayName = "Box";

/* ------------------------------------------------------------------- Txt */

/** Lets a parent (Button, Badge…) set the default colour of text and icons inside it. */
export const ContentColorContext = createContext<string | null>(null);
const NestedTextContext = createContext(false);
/** Buttons force every icon inside them to 16px on the web ([&_svg]:size-4). */
export const ForcedIconSizeContext = createContext<number | null>(null);

export type TxtProps = TextProps & { className?: string };

export function Txt({ className, style, children, ...props }: TxtProps) {
  const { tw, colors } = useTheme();
  const contentColor = useContext(ContentColorContext);
  const nested = useContext(NestedTextContext);

  const own = StyleSheet.flatten([className ? tw.style(className) : null, style]) as TextStyle;
  let flat: Record<string, any>;
  if (nested) {
    // Inline spans inherit from the parent text; only apply what was set explicitly.
    flat = own?.fontWeight || own?.fontFamily ? resolveFont({ ...own }) : { ...own };
  } else {
    flat = resolveFont({ color: contentColor ?? colors.foreground, fontSize: 16, ...own });
    if (flat.lineHeight == null) flat.lineHeight = Math.round((flat.fontSize ?? 16) * 1.5);
    if (Platform.OS === "android") flat.includeFontPadding = false;
  }

  return (
    <NestedTextContext.Provider value={true}>
      <Text allowFontScaling={false} style={flat} {...props}>
        {children}
      </Text>
    </NestedTextContext.Provider>
  );
}

/* ----------------------------------------------------------------- Press */

export type PressProps = Omit<PressableProps, "style"> & {
  className?: string;
  /** extra classes applied while the finger is down */
  activeClassName?: string;
  style?: StyleProp<ViewStyle>;
  /** opacity while pressed (set to 1 to disable the dim) */
  activeOpacity?: number;
};

export const Press = React.forwardRef<ViewRef, PressProps>(
  ({ className, activeClassName, style, activeOpacity = 0.7, disabled, ...props }, ref) => {
    const { tw, colors } = useTheme();
    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        style={({ pressed }) => [
          { borderColor: colors.border },
          className ? tw.style(className) : null,
          style,
          pressed && activeClassName ? tw.style(activeClassName) : null,
          pressed && !activeClassName ? { opacity: activeOpacity } : null,
        ]}
        {...props}
      />
    );
  },
);
Press.displayName = "Press";

/* ------------------------------------------------------------------ Icon */

type IconProps = {
  as: LucideIcon;
  /** Tailwind classes: w-4 h-4 sets the size, text-* sets the colour, the rest goes on a wrapper. */
  className?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
};

export function Icon({ as: Cmp, className, size, color, strokeWidth = 2, fill }: IconProps) {
  const { tw, colors } = useTheme();
  const contentColor = useContext(ContentColorContext);
  const forcedSize = useContext(ForcedIconSizeContext);
  const s = (className ? tw.style(className) : {}) as Record<string, any>;
  const { width, height, color: classColor, ...rest } = s;
  const finalSize = forcedSize ?? size ?? (typeof width === "number" ? width : typeof height === "number" ? height : 24);
  const finalColor = color ?? classColor ?? contentColor ?? colors.foreground;
  const icon = <Cmp size={finalSize} color={finalColor} strokeWidth={strokeWidth} fill={fill ?? "none"} />;
  if (Object.keys(rest).length === 0) return icon;
  return <View style={rest}>{icon}</View>;
}

/* --------------------------------------------------------------- Spinner */

/** Equivalent of `<Loader2 className="animate-spin" />`. */
export function Spinner({ className = "w-4 h-4", color }: { className?: string; color?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon as={Loader2} className={className} color={color} />
    </Animated.View>
  );
}

/** Full-screen centred loader (ProtectedRoute / AuthCallback on web). */
export function FullScreenLoader() {
  return (
    <Box className="flex-1 items-center justify-center bg-background">
      <Spinner className="w-8 h-8 text-primary" />
    </Box>
  );
}

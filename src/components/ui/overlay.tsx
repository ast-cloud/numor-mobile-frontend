// Dialog, AlertDialog, Sheet — JS overlays that mirror the shadcn/Radix components on mobile web.
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTheme } from "@/hooks/use-theme";
import { Portal } from "./portal";
import { Box, BoxProps, Icon, Press, Txt, TxtProps } from "./primitives";
import { Button, ButtonProps } from "./button";

const nativeDriver = Platform.OS !== "web";

/** Keeps content mounted while the closing animation plays. */
function usePresence(open: boolean, duration: number) {
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: nativeDriver,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, duration, progress]);
  return { mounted, progress };
}

function useBackButton(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);
}

/* ---------------------------------------------------------------- Dialog */

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** classes for the content box (e.g. "max-w-sm rounded-lg") */
  className?: string;
  /** hide the X button */
  hideClose?: boolean;
  /** tapping the backdrop closes the dialog (default true; AlertDialog sets false) */
  dismissable?: boolean;
  /** padding/gap classes for the scroll content (defaults to p-6 gap-4) */
  contentClassName?: string;
  /** gap kept on each side of the screen (web: w-[calc(100vw-2rem)] => 16) */
  sideMargin?: number;
  /** largest share of the screen height the dialog may take (web: max-h-[90vh] => 0.9) */
  maxHeightRatio?: number;
  /** fixed share of the screen height (web: h-[85vh] => 0.85); the content then lays itself out and is not wrapped in a scroll view */
  heightRatio?: number;
  /** ref to the dialog's scroll view */
  scrollRef?: React.Ref<any>;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  className,
  hideClose,
  dismissable = true,
  contentClassName,
  sideMargin = 0,
  maxHeightRatio = 0.9,
  heightRatio,
  scrollRef,
  children,
}: DialogProps) {
  const { tw } = useTheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { mounted, progress } = usePresence(open, 200);
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useBackButton(open, close);
  if (!mounted) return null;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });
  return (
    <Portal>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]} pointerEvents={open ? "auto" : "none"}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.8)" }]}
          onPress={dismissable ? close : undefined}
          accessibilityLabel="Close dialog"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[tw.style("flex-1 items-center justify-center"), { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              tw.style(`w-full max-w-lg border border-border bg-background shadow-lg ${className ?? ""}`),
              { maxHeight: (height - insets.top - insets.bottom) * maxHeightRatio, transform: [{ scale }] },
              heightRatio ? { height: (height - insets.top - insets.bottom) * heightRatio } : null,
              sideMargin ? { width: width - sideMargin * 2 } : null,
            ]}
          >
            {heightRatio ? (
              children
            ) : (
              <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={tw.style(contentClassName ?? "p-6 gap-4")}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {children}
              </ScrollView>
            )}
            {!hideClose && (
              <Press onPress={close} hitSlop={12} className="absolute right-4 top-4 rounded-sm opacity-70" accessibilityLabel="Close">
                <Icon as={X} className="h-4 w-4" />
              </Press>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Portal>
  );
}

// On phones the web header/footer are centred and stacked (the sm: variants don't apply).
export const DialogHeader = ({ className, ...p }: BoxProps) => <Box className={`gap-1.5 items-center ${className ?? ""}`} {...p} />;
export const DialogTitle = ({ className, ...p }: TxtProps) => (
  <Txt className={`font-display text-lg leading-[18px] font-semibold tracking-tight text-center ${className ?? ""}`} {...p} />
);
export const DialogDescription = ({ className, ...p }: TxtProps) => (
  <Txt className={`text-sm text-muted-foreground text-center ${className ?? ""}`} {...p} />
);
export const DialogFooter = ({ className, ...p }: BoxProps) => <Box className={`flex-col-reverse ${className ?? ""}`} {...p} />;

/* ----------------------------------------------------------- AlertDialog */

export const AlertDialog = (props: DialogProps) => <Dialog hideClose dismissable={false} {...props} />;
export const AlertDialogHeader = ({ className, ...p }: BoxProps) => <Box className={`gap-2 items-center ${className ?? ""}`} {...p} />;
export const AlertDialogTitle = ({ className, ...p }: TxtProps) => (
  <Txt className={`font-display text-lg font-semibold text-center ${className ?? ""}`} {...p} />
);
export const AlertDialogDescription = DialogDescription;
export const AlertDialogFooter = DialogFooter;
export const AlertDialogCancel = ({ className, ...p }: ButtonProps) => (
  <Button variant="outline" className={`mt-2 ${className ?? ""}`} {...p} />
);
export const AlertDialogAction = (p: ButtonProps) => <Button {...p} />;

/* ----------------------------------------------------------------- Sheet */

export function Sheet({
  open,
  onOpenChange,
  side = "left",
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  const { tw } = useTheme();
  const { width, height } = useWindowDimensions();
  const { mounted, progress } = usePresence(open, open ? 400 : 300);
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useBackButton(open, close);
  if (!mounted) return null;

  const pos =
    side === "left"
      ? { left: 0, top: 0, bottom: 0 }
      : side === "right"
        ? { right: 0, top: 0, bottom: 0 }
        : { left: 0, right: 0, bottom: 0 };
  const transform =
    side === "bottom"
      ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }]
      : [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [side === "left" ? -width : width, 0] }) }];

  return (
    <Portal>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]} pointerEvents={open ? "auto" : "none"}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.8)" }]} onPress={close} />
      </Animated.View>
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[{ position: "absolute", ...pos, transform }, tw.style(`bg-background shadow-lg ${className ?? ""}`)]}
      >
        {children}
      </Animated.View>
    </Portal>
  );
}

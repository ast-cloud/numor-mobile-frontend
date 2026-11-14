// Same `toast({ title, description, variant })` API as the web app's use-toast hook.
import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTheme } from "@/hooks/use-theme";
import { Box, Icon, Press, Txt } from "@/components/ui/primitives";

type ToastInput = { title?: string; description?: string; variant?: "default" | "destructive"; duration?: number };
type ToastItem = ToastInput & { id: number };

let current: ToastItem | null = null; // TOAST_LIMIT = 1, like the web app
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: ToastInput) {
  current = { ...input, id: nextId++ };
  emit();
}

const dismiss = (id?: number) => {
  if (id === undefined || current?.id === id) {
    current = null;
    emit();
  }
};

export const useToast = () => ({ toast, dismiss });

export function Toaster() {
  const item = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
  const { tw } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!item) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== "web" }).start();
    const t = setTimeout(() => dismiss(item.id), item.duration ?? 5000);
    return () => clearTimeout(t);
  }, [item, anim]);

  if (!item) return null;
  const destructive = item.variant === "destructive";
  const fg = destructive ? "text-destructive-foreground" : "text-foreground";
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]} pointerEvents="box-none">
      <Animated.View
        style={[
          tw.style("p-4"),
          { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] },
        ]}
        pointerEvents="box-none"
      >
        <Box
          className={`w-full flex-row items-center justify-between rounded-md border p-6 pr-8 shadow-lg ${
            destructive ? "border-destructive bg-destructive" : "border-border bg-background"
          }`}
        >
          <Box className="flex-1 gap-1">
            {item.title ? <Txt className={`text-sm font-semibold ${fg}`}>{item.title}</Txt> : null}
            {item.description ? <Txt className={`text-sm opacity-90 ${fg}`}>{item.description}</Txt> : null}
          </Box>
          <Press onPress={() => dismiss(item.id)} hitSlop={10} className="absolute right-2 top-2 rounded-md p-1">
            <Icon as={X} className={`h-4 w-4 ${destructive ? "text-destructive-foreground" : "text-foreground/50"}`} />
          </Press>
        </Box>
      </Animated.View>
    </View>
  );
}

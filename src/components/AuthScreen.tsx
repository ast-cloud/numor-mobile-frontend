import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Press, Txt } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import Navbar, { NAVBAR_HEIGHT } from "./Navbar";

/** Page shell shared by the public screens: fixed navbar + scrollable, keyboard-aware body. */
export function AuthScreen({ children, center, className }: { children: React.ReactNode; center?: boolean; className?: string }) {
  const insets = useSafeAreaInsets();
  const { tw } = useTheme();
  return (
    <Box className="flex-1 bg-background">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { flexGrow: 1, paddingTop: insets.top + NAVBAR_HEIGHT, paddingBottom: insets.bottom },
            center ? { justifyContent: "center" } : null,
          ]}
        >
          <Box className={className ?? "px-4 py-16"} style={tw.style("w-full")}>
            {children}
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
      <Navbar />
    </Box>
  );
}

/** Input with a leading icon (web: relative wrapper + absolutely positioned icon). */
export function IconField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box className="relative justify-center">
      {children}
      <Box className="absolute left-3" pointerEvents="none">
        {icon}
      </Box>
    </Box>
  );
}

export function OrDivider() {
  return (
    <Box className="my-6 w-full justify-center">
      <Box className="absolute inset-x-0 border-t border-border" />
      <Box className="items-center">
        <Txt className="bg-background px-2 text-xs uppercase text-muted-foreground">Or</Txt>
      </Box>
    </Box>
  );
}

export function TextLink({ children, onPress, className }: { children: React.ReactNode; onPress: () => void; className?: string }) {
  return (
    <Press onPress={onPress} hitSlop={8}>
      <Txt className={className ?? "text-xs text-primary"}>{children}</Txt>
    </Press>
  );
}

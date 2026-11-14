import React from "react";
import { KeyboardAvoidingView, Platform, RefreshControlProps, ScrollView } from "react-native";
import { Redirect } from "expo-router";
import { Moon, Sun } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, Icon } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import type { ModuleKey } from "@/lib/authStore";
import { firstAllowedRoute } from "@/lib/permissions";

/**
 * Scrollable body of a dashboard page: the web layout's <main className="px-4 pb-4 pt-20">
 * plus the theme toggle, which sits at the top right of the page and scrolls with it.
 * `module` applies the same PermissionGuard the web routes use.
 */
export function DashboardScreen({
  children,
  module,
  refreshControl,
  scrollRef,
}: {
  children: React.ReactNode;
  module?: ModuleKey;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  scrollRef?: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
}) {
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme, tw } = useTheme();
  const { can, isSubAccount, user } = useAuth();

  if (module && isSubAccount && !can(module, "read")) {
    return <Redirect href={firstAllowedRoute(user?.permissions ?? null) as never} />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        style={tw.style("flex-1 bg-background")}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingTop: insets.top + 80, paddingBottom: insets.bottom + 16, paddingHorizontal: 16, flexGrow: 1 }}
      >
        <Box className="absolute right-4" style={{ top: insets.top + 16 }}>
          <Button variant="ghost" size="icon" onPress={toggleTheme} accessibilityLabel="Toggle theme">
            <Icon as={theme === "dark" ? Sun : Moon} className="w-5 h-5 text-muted-foreground" />
          </Button>
        </Box>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { hydrateToken } from "@/lib/api/authToken";
import { hydrateStorage } from "@/lib/storage";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import { FeatureFlagsProvider } from "@/hooks/use-feature-flags";
import { Toaster } from "@/hooks/use-toast";
import { PortalHost } from "@/components/ui/portal";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

function Shell() {
  const { theme, colors } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: colors.background } }} />
      <PortalHost />
      <Toaster />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([hydrateToken(), hydrateStorage()]).finally(() => setHydrated(true));
  }, []);

  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FeatureFlagsProvider>
            <AuthProvider>
              <Shell />
            </AuthProvider>
          </FeatureFlagsProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

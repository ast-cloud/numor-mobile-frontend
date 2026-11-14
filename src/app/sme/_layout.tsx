import { useState } from "react";
import { Redirect, Stack } from "expo-router";
import { Menu } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatBot from "@/components/ChatBot";
import Sidebar from "@/components/Sidebar";
import { Box, Button, FullScreenLoader, Icon, Sheet } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useTheme } from "@/hooks/use-theme";
import { getToken } from "@/lib/api/authToken";

// Web: <ProtectedRoute><DashboardLayout /></ProtectedRoute> in its mobile layout —
// off-canvas sidebar, a fixed menu button at the top left and the floating chatbot.
export default function SmeLayout() {
  const { user, isLoading } = useAuth();
  const { flags } = useFeatureFlags();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!getToken()) return <Redirect href="/login" />;
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Redirect href="/login" />;

  return (
    <Box className="flex-1 bg-background">
      <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: colors.background } }} />

      <Box className="absolute left-4" style={{ top: insets.top + 16 }}>
        <Button variant="ghost" size="icon" onPress={() => setSidebarOpen(true)} accessibilityLabel="Open sidebar">
          <Icon as={Menu} className="w-5 h-5 text-muted-foreground" />
        </Button>
      </Box>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen} side="left" className="w-[18rem] bg-card">
        <Sidebar onMobileClose={() => setSidebarOpen(false)} />
      </Sheet>

      {flags.FF_AI_CHATBOT && <ChatBot />}
    </Box>
  );
}

import { usePathname, useRouter } from "expo-router";
import { FileText, LayoutDashboard, LogOut, LucideIcon, Receipt, Settings, User, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, ContentColorContext, Icon, Press, Txt } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

// CA Connect and the CA dashboard are not part of the mobile app yet, so only the SME items are listed.
const regularNavItems = [
  { title: "Dashboard", url: "/sme/dashboard", icon: LayoutDashboard, module: "dashboard" as const },
  { title: "Expenses", url: "/sme/expenses", icon: Receipt, module: "expense" as const },
  { title: "Income", url: "/sme/income", icon: FileText, module: "income" as const },
];

function NavRow({ title, icon, active, onPress, destructiveOnPress }: { title: string; icon: LucideIcon; active?: boolean; onPress: () => void; destructiveOnPress?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      activeClassName={active ? "" : destructiveOnPress ? "bg-destructive/10" : "bg-muted"}
      className={`flex-row items-center gap-3 h-10 px-2.5 rounded-lg ${active ? "bg-primary" : ""}`}
    >
      <ContentColorContext.Provider value={active ? colors["primary-foreground"] : colors["muted-foreground"]}>
        <Icon as={icon} className="w-5 h-5" />
        <Txt className="text-sm font-medium">{title}</Txt>
      </ContentColorContext.Provider>
    </Press>
  );
}

const Sidebar = ({ onMobileClose }: { onMobileClose: () => void }) => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, logout, isSubAccount, can } = useAuth();

  const navItems = isSubAccount ? regularNavItems.filter((it) => can(it.module, "read")) : regularNavItems;

  const go = (url: string) => {
    onMobileClose();
    if (pathname !== url) router.replace(url as never);
  };

  const handleLogout = () => {
    logout();
    onMobileClose();
    router.replace("/login" as never);
  };

  return (
    <Box className="flex-1 bg-card border-r border-border" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <Box className="h-16 px-3 border-b border-border flex-row items-center gap-3">
        <Txt className="text-xl font-display font-bold text-primary">Numor</Txt>
        <Button variant="ghost" size="icon" onPress={onMobileClose} className="ml-auto" accessibilityLabel="Close sidebar">
          <Icon as={X} className="w-5 h-5 text-muted-foreground" />
        </Button>
      </Box>

      {/* User profile */}
      <Box className="p-3 border-b border-border">
        <Box className="flex-row items-center gap-3">
          <Box className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
            <Icon as={User} className="w-5 h-5 text-primary" />
          </Box>
          <Box className="flex-1">
            <Txt numberOfLines={1} className="text-sm font-medium">
              {user?.name || "User"}
            </Txt>
            <Txt numberOfLines={1} className="text-xs text-muted-foreground">
              {user?.email || ""}
            </Txt>
          </Box>
        </Box>
      </Box>

      {/* Navigation */}
      <Box className="flex-1 p-3 gap-1">
        {navItems.map((item) => {
          const isActive = item.url === "/sme/dashboard" ? pathname === item.url : pathname.startsWith(item.url);
          return <NavRow key={item.title} title={item.title} icon={item.icon} active={isActive} onPress={() => go(item.url)} />;
        })}
      </Box>

      {/* Settings & logout */}
      <Box className="p-3 border-t border-border gap-1">
        <NavRow title="Settings" icon={Settings} active={pathname === "/sme/settings"} onPress={() => go("/sme/settings")} />
        <NavRow title="Logout" icon={LogOut} onPress={handleLogout} destructiveOnPress />
      </Box>
    </Box>
  );
};

export default Sidebar;

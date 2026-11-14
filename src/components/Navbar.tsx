import { useState } from "react";
import { Menu, User, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Button, Icon, Press, Txt } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";

export const NAVBAR_HEIGHT = 56;

/** Top bar of the public (auth) screens — the mobile layout of the website's Navbar. */
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (path: string) => {
    setIsOpen(false);
    router.replace(path as never);
  };

  return (
    <Box className="absolute top-0 left-0 right-0 bg-background/95 border-b border-border/50 px-4" style={{ paddingTop: insets.top, zIndex: 50 }}>
      <Box className="h-14 flex-row items-center justify-between">
        <Press className="flex-row items-center gap-2" onPress={() => go(user ? "/" : "/login")} activeOpacity={1}>
          <Box className="w-7 h-7 rounded-lg bg-primary items-center justify-center">
            <Txt className="text-primary-foreground font-bold text-base">N</Txt>
          </Box>
          <Txt className="font-display text-lg font-bold">Numor</Txt>
        </Press>
        <Press className="p-2" onPress={() => setIsOpen(!isOpen)} accessibilityLabel="Menu" hitSlop={6}>
          <Icon as={isOpen ? X : Menu} size={20} className="text-muted-foreground" />
        </Press>
      </Box>

      {isOpen && (
        <Box className="py-3 border-t border-border/50">
          <Box className="gap-2">
            {user ? (
              <Button variant="outline" size="sm" className="w-full gap-1.5" onPress={() => go("/")}>
                <Icon as={User} className="w-3.5 h-3.5" />
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="w-full" onPress={() => go("/login")}>
                  Log in
                </Button>
                <Button variant="hero" size="sm" className="w-full" onPress={() => go("/signup")}>
                  Get Started
                </Button>
              </>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Navbar;

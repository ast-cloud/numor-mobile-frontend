import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/lib/storage";
import { darkColors, gradients, lightColors, ThemeColors } from "@/theme/tokens";
import { Tw, twDark, twLight } from "@/theme/tw";

type Theme = "dark" | "light";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  tw: Tw;
  colors: ThemeColors;
  gradients: (typeof gradients)["light"] | (typeof gradients)["dark"];
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Same default and storage key as the web app.
  const [theme, setTheme] = useState<Theme>(() => (storage.getItem("numor-theme") as Theme) || "light");

  useEffect(() => {
    storage.setItem("numor-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
      tw: theme === "dark" ? twDark : twLight,
      colors: theme === "dark" ? darkColors : lightColors,
      gradients: gradients[theme],
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}

/** Tailwind-style class resolver for the active theme. */
export const useTw = () => useTheme().tw;

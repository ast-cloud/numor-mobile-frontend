// Design tokens copied from the web frontend (src/index.css + tailwind.config.ts).
// HSL values are converted to hex so opacity modifiers (bg-primary/10) work natively.
export type ThemeName = "light" | "dark";

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  popover: string;
  "popover-foreground": string;
  primary: string;
  "primary-foreground": string;
  secondary: string;
  "secondary-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  "accent-foreground": string;
  destructive: string;
  "destructive-foreground": string;
  border: string;
  input: string;
  ring: string;
}

export const lightColors: ThemeColors = {
  background: "#ffffff",
  foreground: "#14181f",
  card: "#fafafa",
  "card-foreground": "#14181f",
  popover: "#ffffff",
  "popover-foreground": "#14181f",
  primary: "#0ea472",
  "primary-foreground": "#ffffff",
  secondary: "#f3f4f6",
  "secondary-foreground": "#14181f",
  muted: "#f3f4f6",
  "muted-foreground": "#5c6370",
  accent: "#0ea472",
  "accent-foreground": "#ffffff",
  destructive: "#eb1414",
  "destructive-foreground": "#ffffff",
  border: "#e2e4e9",
  input: "#e2e4e9",
  ring: "#0ea472",
};

export const darkColors: ThemeColors = {
  background: "#080a0c",
  foreground: "#f8fafc",
  card: "#111318",
  "card-foreground": "#f8fafc",
  popover: "#111318",
  "popover-foreground": "#f8fafc",
  primary: "#10b77f",
  "primary-foreground": "#080a0c",
  secondary: "#1e2229",
  "secondary-foreground": "#f8fafc",
  muted: "#22272f",
  "muted-foreground": "#7588a3",
  accent: "#10b77f",
  "accent-foreground": "#080a0c",
  destructive: "#ef4343",
  "destructive-foreground": "#f8fafc",
  border: "#272b35",
  input: "#272b35",
  ring: "#10b77f",
};

export const gradients = {
  light: { primary: ["#0ea472", "#18b4b4"] as const, card: ["#ffffff", "#f9fafb"] as const },
  dark: { primary: ["#10b77f", "#1ccaca"] as const, card: ["#15181e", "#0d0e12"] as const },
};

export const shadows = {
  light: {
    card: "0px 4px 24px rgba(20, 24, 31, 0.08)",
    glow: "0px 0px 60px rgba(14, 164, 114, 0.15)",
  },
  dark: {
    card: "0px 4px 24px rgba(0, 0, 0, 0.4)",
    glow: "0px 0px 60px rgba(16, 183, 127, 0.3)",
  },
};

// --radius: 0.5rem
export const radius = { sm: 4, md: 6, lg: 8, xl: 10, "2xl": 14 };

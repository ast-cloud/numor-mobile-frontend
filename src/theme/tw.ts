import { create, plugin } from "twrnc";
import { darkColors, lightColors, radius, shadows, ThemeColors, ThemeName } from "./tokens";

const make = (name: ThemeName, colors: ThemeColors) =>
  create({
    theme: {
      extend: {
        colors: colors as unknown as Record<string, string>,
        fontFamily: { display: "SpaceGrotesk", body: "Inter" },
        borderRadius: {
          sm: `${radius.sm}px`,
          md: `${radius.md}px`,
          lg: `${radius.lg}px`,
          xl: `${radius.xl}px`,
          "2xl": `${radius["2xl"]}px`,
        },
      },
    },
    plugins: [
      plugin(({ addUtilities }) => {
        addUtilities({
          // Same box-shadow values Tailwind emits on web, so both platforms render alike.
          "shadow-sm": { boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.05)" },
          shadow: { boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px -1px rgba(0, 0, 0, 0.1)" },
          "shadow-md": { boxShadow: "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)" },
          "shadow-lg": { boxShadow: "0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)" },
          "shadow-xl": { boxShadow: "0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)" },
          "shadow-card": { boxShadow: shadows[name].card },
          "shadow-glow": { boxShadow: shadows[name].glow },
          "shadow-none": { boxShadow: "none" },
        } as never);
      }),
    ],
  });

export const twLight = make("light", lightColors);
export const twDark = make("dark", darkColors);
export type Tw = typeof twLight;

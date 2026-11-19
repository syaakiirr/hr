import { createContext, useContext, useEffect, type ReactNode } from "react";
import InkSpillThemeSwitch, {
  type InkTheme,
} from "@/components/ui/ink-spill-theme-switch";

type Theme = InkTheme;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (from?: Element | null) => void;
  spilling: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("socihr-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  localStorage.setItem("socihr-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  return (
    <InkSpillThemeSwitch defaultTheme={getInitialTheme()} onThemeChange={applyTheme} duration={2200}>
      {({ theme, toggle, spilling }) => (
        <ThemeContext.Provider value={{ theme, toggleTheme: toggle, spilling }}>
          {children}
        </ThemeContext.Provider>
      )}
    </InkSpillThemeSwitch>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

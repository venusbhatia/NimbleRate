import { create } from "zustand";

interface DashboardState {
  activeNav: "dashboard" | "calendar" | "events" | "settings";
  theme: "light" | "dark";
  pricePeriod: 7 | 14 | 30;
  isMobileMenuOpen: boolean;
  setActiveNav: (activeNav: DashboardState["activeNav"]) => void;
  setTheme: (theme: DashboardState["theme"]) => void;
  setPricePeriod: (period: DashboardState["pricePeriod"]) => void;
  toggleTheme: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

function getStoredTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem("nimblerate-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* localStorage may be unavailable */
  }
  return "light";
}

function persistTheme(theme: "light" | "dark") {
  try {
    localStorage.setItem("nimblerate-theme", theme);
  } catch {
    /* ignore */
  }
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  activeNav: "dashboard",
  theme: getStoredTheme(),
  pricePeriod: 30,
  isMobileMenuOpen: false,
  setActiveNav: (activeNav) => set({ activeNav, isMobileMenuOpen: false }),
  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },
  setPricePeriod: (pricePeriod) => set({ pricePeriod }),
  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    persistTheme(next);
    set({ theme: next });
  },
  toggleMobileMenu: () => set({ isMobileMenuOpen: !get().isMobileMenuOpen }),
  closeMobileMenu: () => set({ isMobileMenuOpen: false })
}));

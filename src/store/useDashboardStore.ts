import { create } from "zustand";

interface DashboardState {
  activeNav: "dashboard" | "calendar" | "events" | "settings";
  theme: "light" | "dark";
  pricePeriod: 7 | 14 | 30;
  setActiveNav: (activeNav: DashboardState["activeNav"]) => void;
  setTheme: (theme: DashboardState["theme"]) => void;
  setPricePeriod: (period: DashboardState["pricePeriod"]) => void;
  toggleTheme: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  activeNav: "dashboard",
  theme: "light",
  pricePeriod: 30,
  setActiveNav: (activeNav) => set({ activeNav }),
  setTheme: (theme) => set({ theme }),
  setPricePeriod: (pricePeriod) => set({ pricePeriod }),
  toggleTheme: () => set({ theme: get().theme === "light" ? "dark" : "light" })
}));

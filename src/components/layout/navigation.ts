import { Activity, CalendarRange, ChartNoAxesCombined, Cog, Ticket } from "lucide-react";

export const dashboardNavItems = [
  { id: "dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { id: "calendar", label: "Calendar", icon: CalendarRange },
  { id: "events", label: "Events", icon: Ticket },
  { id: "operations", label: "Operations", icon: Activity },
  { id: "settings", label: "Settings", icon: Cog }
] as const;

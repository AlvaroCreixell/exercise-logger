import { NavLink, Outlet } from "react-router";
import { CalendarDays, Dumbbell, History, Settings } from "lucide-react";
import RestTimer from "@/components/RestTimer";

const tabs = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <RestTimer />

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav
        className="border-t border-border bg-background"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
} from "react-router";
import { Toaster } from "sonner";
import { CalendarDays, Dumbbell, History, Settings } from "lucide-react";
import { useAppInit } from "@/shared/hooks/useAppInit";
import { useSettings } from "@/shared/hooks/useSettings";

import TodayScreen from "@/features/today/TodayScreen";
import WorkoutScreen from "@/features/workout/WorkoutScreen";
import HistoryScreen from "@/features/history/HistoryScreen";
import SessionDetailScreen from "@/features/history/SessionDetailScreen";
import ExerciseHistoryScreen from "@/features/history/ExerciseHistoryScreen";
import SettingsScreen from "@/features/settings/SettingsScreen";

const tabs = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function ThemeSync() {
  const settings = useSettings();
  const theme = settings?.theme;
  useEffect(() => {
    if (!settings) return;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () =>
        document.documentElement.classList.toggle("dark", mq.matches);
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings, theme]);
  return null;
}

function Shell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <ThemeSync />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav
        className="border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
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
                    ? "text-primary font-semibold"
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

function AppRoutes() {
  const { ready, error } = useAppInit();

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <p className="text-destructive">Failed to initialize: {error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/workout" element={<WorkoutScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:sessionId" element={<SessionDetailScreen />} />
        <Route
          path="/history/exercise/:exerciseId"
          element={<ExerciseHistoryScreen />}
        />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <BrowserRouter basename="/exercise-logger">
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton duration={3000} />
    </>
  );
}

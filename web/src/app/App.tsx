import { Suspense, lazy } from "react";
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

const TodayScreen = lazy(() => import("@/features/today/TodayScreen"));
const WorkoutScreen = lazy(() => import("@/features/workout/WorkoutScreen"));
const HistoryScreen = lazy(() => import("@/features/history/HistoryScreen"));
const SessionDetailScreen = lazy(
  () => import("@/features/history/SessionDetailScreen"),
);
const ExerciseHistoryScreen = lazy(
  () => import("@/features/history/ExerciseHistoryScreen"),
);
const SettingsScreen = lazy(() => import("@/features/settings/SettingsScreen"));

const tabs = [
  { to: "/", label: "Today", icon: CalendarDays },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function LoadingState({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center p-4 ${
        fullscreen ? "h-screen" : "h-full min-h-40"
      }`}
    >
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}

function Shell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>
      <nav
        className="border-t-2 border-border-strong bg-background pb-[env(safe-area-inset-bottom)]"
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
                `relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-cta/30 outline-none ${
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-3 bg-cta" />
                  )}
                </>
              )}
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
    return <LoadingState fullscreen />;
  }

  return (
    <Suspense fallback={<LoadingState fullscreen />}>
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
    </Suspense>
  );
}

export default function App() {
  return (
    <>
      <BrowserRouter basename="/exercise-logger">
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={3000}
        toastOptions={{
          className: "!rounded !border-[1.5px] !border-border-strong !shadow-sm font-sans",
        }}
      />
    </>
  );
}

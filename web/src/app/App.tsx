import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
} from "react-router";
import { Toaster } from "sonner";
import { Grid, Dumbbell, Graph, Settings } from "@/shared/icons";
import { useAppInit } from "@/shared/hooks/useAppInit";
import { useRoutineLaunchQueue } from "@/shared/hooks/useRoutineLaunchQueue";
import { useSettings } from "@/shared/hooks/useSettings";
import { SWUpdatePrompt } from "./SWUpdatePrompt";

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
const RoutineImportScreen = lazy(
  () => import("@/features/settings/RoutineImportScreen"),
);
const ShareTargetRedirect = lazy(
  () => import("@/features/settings/ShareTargetRedirect"),
);
const OnboardingWelcomeScreen = lazy(
  () => import("@/features/onboarding/OnboardingWelcomeScreen"),
);
const QuestionnaireScreen = lazy(
  () => import("@/features/onboarding/QuestionnaireScreen"),
);
const GenerationScreen = lazy(
  () => import("@/features/onboarding/GenerationScreen"),
);

const tabs = [
  { to: "/", label: "Today", icon: Grid },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: Graph },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function LoadingState({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center p-4 ${
        fullscreen ? "h-screen" : "h-full min-h-40"
      }`}
    >
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className="animate-glyph-pulse text-accent-cli select-none">
          ✻
        </span>
        Loading...
      </p>
    </div>
  );
}

function FadeRoute({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div
      key={pathname}
      className="h-full animate-[fadeInUp_var(--dur-fadeInUp)_var(--ease-handoff)]"
    >
      {children}
    </div>
  );
}

function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <FadeRoute>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </FadeRoute>
      </main>
      <nav
        className="border-t border-line bg-background pb-[env(safe-area-inset-bottom)]"
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
                `relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs lowercase transition-all duration-[var(--dur-base)] focus-visible:ring-2 focus-visible:ring-accent-cli/40 outline-none active:scale-95 rounded-[var(--radius-button)] ${
                  isActive
                    ? "text-accent-cli font-semibold"
                    : "text-ink-3 hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function OnboardingLayout() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto">
        <FadeRoute>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </FadeRoute>
      </main>
    </div>
  );
}

export function AppRoutes() {
  const { ready, error } = useAppInit();
  useRoutineLaunchQueue();
  const settings = useSettings();
  const location = useLocation();

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

  if (!settings) return <LoadingState fullscreen />;

  // First-run gate.
  if (
    location.pathname === "/" &&
    settings.onboardingCompletedAt == null &&
    settings.onboardingSkippedAt == null
  ) {
    return <Navigate to="/onboarding" replace />;
  }
  // Post-onboarding guard on /onboarding: a user who has completed OR skipped
  // onboarding should never see the welcome screen again. This also breaks
  // the live-query race after "Maybe later" — settings write completes
  // asynchronously, but once the flag eventually propagates this guard
  // redirects the user to Today.
  if (
    location.pathname === "/onboarding" &&
    (settings.onboardingCompletedAt !== null ||
      settings.onboardingSkippedAt !== null)
  ) {
    return <Navigate to="/" replace />;
  }
  return (
    <Suspense fallback={<LoadingState fullscreen />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/workout" element={<WorkoutScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/history/:sessionId" element={<SessionDetailScreen />} />
          <Route
            path="/history/exercise/:exerciseId"
            element={<ExerciseHistoryScreen />}
          />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/import" element={<RoutineImportScreen />} />
          <Route path="/share-target" element={<ShareTargetRedirect />} />
        </Route>
        <Route element={<OnboardingLayout />}>
          <Route path="/onboarding" element={<OnboardingWelcomeScreen />} />
          <Route
            path="/onboarding/questionnaire"
            element={<QuestionnaireScreen />}
          />
          <Route path="/onboarding/generate" element={<GenerationScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
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
        theme="dark"
        closeButton
        duration={3000}
        toastOptions={{
          className:
            "!rounded-[var(--radius-card)] !border !border-line !bg-card !text-foreground font-sans",
        }}
      />
      <SWUpdatePrompt />
    </>
  );
}

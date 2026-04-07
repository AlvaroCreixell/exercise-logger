import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
} from "react-router";
import { Toaster } from "sonner";
import { useAppInit } from "@/shared/hooks/useAppInit";

const tabs = [
  { to: "/", label: "Today" },
  { to: "/workout", label: "Workout" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" },
] as const;

function Shell() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
      <nav
        className="border-t border-border bg-background"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map(({ to, label }) => (
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
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Placeholder({ heading }: { heading: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <h1 className="text-lg text-muted-foreground">{heading}</h1>
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
        <Route path="/" element={<Placeholder heading="No Active Routine" />} />
        <Route
          path="/workout"
          element={<Placeholder heading="No Active Workout" />}
        />
        <Route
          path="/history"
          element={<Placeholder heading="No History Yet" />}
        />
        <Route
          path="/history/:sessionId"
          element={<Placeholder heading="Session Detail" />}
        />
        <Route
          path="/history/exercise/:exerciseId"
          element={<Placeholder heading="Exercise History" />}
        />
        <Route
          path="/settings"
          element={<Placeholder heading="Settings" />}
        />
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

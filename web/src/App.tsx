import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import AppShell from "@/components/AppShell";
import TodayScreen from "@/screens/TodayScreen";
import WorkoutScreen from "@/screens/WorkoutScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import SessionDetailScreen from "@/screens/SessionDetailScreen";
import ExerciseHistoryScreen from "@/screens/ExerciseHistoryScreen";
import { useAppInit } from "@/hooks/useAppInit";

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter basename="/exercise-logger">
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;

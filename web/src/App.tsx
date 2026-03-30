import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import AppShell from "@/components/AppShell";
import TodayScreen from "@/screens/TodayScreen";
import WorkoutScreen from "@/screens/WorkoutScreen";
import HistoryScreen from "@/screens/HistoryScreen";
import SettingsScreen from "@/screens/SettingsScreen";

function App() {
  return (
    <BrowserRouter basename="/exercise-logger">
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/workout" element={<WorkoutScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

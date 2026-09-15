import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import Board from "./pages/Board";
import MyTasks from "./pages/MyTasks";
import ProjectMemory from "./pages/ProjectMemory";
import PersonalTimeline from "./pages/PersonalTimeline";
import TeamCapacity from "./pages/TeamCapacity";
import DeadlineScenario from "./pages/DeadlineScenario";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/projects"
        element={
          <RequireAuth>
            <Projects />
          </RequireAuth>
        }
      />
      <Route
        path="/my-tasks"
        element={
          <RequireAuth>
            <MyTasks />
          </RequireAuth>
        }
      />
      <Route path="/timeline" element={<RequireAuth><PersonalTimeline /></RequireAuth>} />
      <Route path="/team-capacity" element={<RequireAuth><TeamCapacity /></RequireAuth>} />
      <Route path="/projects/:id/scenario" element={<RequireAuth><DeadlineScenario /></RequireAuth>} />
      <Route
        path="/projects/:id/memory"
        element={
          <RequireAuth>
            <ProjectMemory />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <RequireAuth>
            <Board />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

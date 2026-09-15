import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <Link to="/projects" className="font-display text-lg font-semibold">
            Waypoint
          </Link>
        </div>
        <div className="flex-1 px-3 py-4">
          <Link
            to="/projects"
            className="block px-2.5 py-2 rounded-md text-sm text-ink-soft hover:bg-paper hover:text-ink transition-colors"
          >
            Projects
          </Link>
          <Link
            to="/my-tasks"
            className="block px-2.5 py-2 rounded-md text-sm text-ink-soft hover:bg-paper hover:text-ink transition-colors"
          >
            My tasks
          </Link>
          <Link
            to="/timeline"
            className="block px-2.5 py-2 rounded-md text-sm text-ink-soft hover:bg-paper hover:text-ink transition-colors"
          >
            My timeline
          </Link>
          <Link
            to="/team-capacity"
            className="block px-2.5 py-2 rounded-md text-sm text-ink-soft hover:bg-paper hover:text-ink transition-colors"
          >
            Team capacity
          </Link>
        </div>
        <div className="px-5 py-4 border-t border-border">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-xs text-ink-soft truncate mb-3">{user?.email}</div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-xs text-ink-soft hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

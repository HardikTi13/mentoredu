import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    const role = user?.role?.toLowerCase() || "user";
    navigate(`/login/${role}`);
  };

  const roleLabel = user?.role ?? "";
  const roleBadgeColor =
    roleLabel === "ADMIN"  ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
    roleLabel === "MENTOR" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                             "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg,#0c1222 0%,#1a1a2e 50%,#16213e 100%)" }}>
      {/* Header */}
      <header className="border-b border-white/5 bg-navy-900/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/30">
              M
            </div>
            <span className="text-white font-semibold tracking-tight hidden sm:block">MentorQue</span>
          </div>

          {/* Nav links (role-aware) */}
          <nav className="flex items-center gap-1">
            {user?.role === "USER" && (
              <NavLink
                to="/user"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                📅 Availability
              </NavLink>
            )}
            {user?.role === "MENTOR" && (
              <NavLink
                to="/mentor"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                🧑‍🏫 Dashboard
              </NavLink>
            )}
            {user?.role === "ADMIN" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive ? "bg-amber-500/20 text-amber-300" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                🛠 Admin
              </NavLink>
            )}
          </nav>

          {/* Right: user info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-white text-xs font-medium leading-tight">{user?.name}</span>
              <span className="text-slate-500 text-xs leading-tight">{user?.email}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleBadgeColor}`}>
              {roleLabel}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
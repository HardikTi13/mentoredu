import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_CONFIG = {
  user: {
    title: "User Login",
    subtitle: "Manage your availability & scheduled calls",
    gradient: "from-indigo-500 to-purple-600",
    glow: "shadow-indigo-500/25",
    icon: "👤",
    expectedRole: "USER",
    redirect: "/user",
    hint: "user1@mentorque.com — user10@mentorque.com",
  },
  mentor: {
    title: "Mentor Login",
    subtitle: "Manage your mentoring schedule",
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/25",
    icon: "🧑‍🏫",
    expectedRole: "MENTOR",
    redirect: "/mentor",
    hint: "mentor1@mentorque.com — mentor5@mentorque.com",
  },
  admin: {
    title: "Admin Login",
    subtitle: "Full platform control & scheduling",
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/25",
    icon: "🛠️",
    expectedRole: "ADMIN",
    redirect: "/admin",
    hint: "admin@mentorque.com",
  },
};

export default function LoginPage({ role = "user" }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect immediately
  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN")  navigate("/admin",  { replace: true });
    else if (user.role === "MENTOR") navigate("/mentor", { replace: true });
    else navigate("/user", { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role !== config.expectedRole) {
        setError(`This portal is for ${config.title.replace(" Login", "")}s only. Your role is ${u.role}.`);
        localStorage.removeItem("token");
        setLoading(false);
        return;
      }
      navigate(config.redirect, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#0c1222 0%,#1a1a2e 50%,#16213e 100%)" }}
    >
      {/* Background glow shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: `radial-gradient(circle, var(--tw-gradient-stops))` }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-white/5 via-white/0 to-white/0" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Role switcher tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {Object.entries(ROLE_CONFIG).map(([r, c]) => (
            <button
              key={r}
              onClick={() => navigate(`/login/${r}`)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border ${
                role === r
                  ? `bg-gradient-to-r ${c.gradient} text-white border-transparent shadow-lg ${c.glow}`
                  : "border-white/10 text-slate-400 hover:text-white hover:border-white/20 bg-white/5"
              }`}
            >
              {c.icon} {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {/* Icon + heading */}
          <div className="text-center mb-8">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${config.gradient} text-3xl mb-4 shadow-xl ${config.glow}`}
            >
              {config.icon}
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{config.title}</h1>
            <p className="text-slate-400 text-sm">{config.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl text-sm bg-red-500/10 border border-red-500/30 text-red-300 animate-fade-in-up">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 text-sm transition-all duration-300 outline-none bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="you@mentorque.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 text-sm transition-all duration-300 outline-none bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-300 bg-gradient-to-r ${config.gradient} shadow-lg ${config.glow} hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 rounded-xl bg-white/3 border border-white/8">
            <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Demo credentials</p>
            <p className="text-xs text-slate-400">📧 {config.hint}</p>
            <p className="text-xs text-slate-400 mt-0.5">🔑 password123</p>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          MentorQue · Mentoring Call Scheduling Platform
        </p>
      </div>
    </div>
  );
}

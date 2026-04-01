import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import * as availabilityApi from "../api/availability";
import * as authApi from "../api/auth";
import { getMyMeetings } from "../api/meetings";
import {
  getWeekStartStr,
  formatDateLocal,
  formatTimeLocal,
  formatTimeRange,
  slotToUTC,
  isPastDate,
  isPastDateTime,
} from "../utils/time";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "GMT (GMT+0)" },
  { value: "IST", label: "IST (GMT+5:30)" },
];

const CALL_TYPE_LABELS = {
  RESUME_REVAMP:       { label: "Resume Revamp",       icon: "📄", color: "text-blue-300 bg-blue-500/10 border-blue-500/20" },
  JOB_MARKET_GUIDANCE: { label: "Job Market Guidance", icon: "💼", color: "text-purple-300 bg-purple-500/10 border-purple-500/20" },
  MOCK_INTERVIEW:      { label: "Mock Interview",       icon: "🎤", color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
};

function TabButton({ id, label, icon, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
        active
          ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
      }`}
    >
      {icon} {label}
    </button>
  );
}

export default function UserDashboard() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("availability");

  // ── Availability state ──────────────────────────────────────
  const [displayTimezone, setDisplayTimezone] = useState("UTC");
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState({ dates: [], availability: {} });
  const [avLoading, setAvLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState({});
  const [avError, setAvError] = useState("");

  // ── Profile state ───────────────────────────────────────────
  const [tags, setTags] = useState([]);
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // ── Meetings state ──────────────────────────────────────────
  const [meetings, setMeetings] = useState([]);
  const [meetLoading, setMeetLoading] = useState(false);

  // Sync profile from user
  useEffect(() => {
    if (user) {
      setTags(user.tags || []);
      setDescription(user.description || "");
    }
  }, [user]);

  // ── Availability helpers ────────────────────────────────────
  const buildGridDates = () => {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
  };
  const gridDates = buildGridDates();

  const fetchWeekly = useCallback(async () => {
    if (!user) return;
    setAvLoading(true);
    setAvError("");
    try {
      const res = await availabilityApi.getWeekly({ weekStart: gridDates[0] });
      setData(res);
    } catch (e) {
      setAvError(e.message || "Failed to load availability");
    } finally {
      setAvLoading(false);
    }
  }, [weekOffset, user?.id]);

  useEffect(() => { setToggles({}); }, [weekOffset]);
  useEffect(() => { if (user) fetchWeekly(); }, [fetchWeekly]);

  const isSlotEnabled = (dateStr, hour) => {
    const key = `${dateStr}-${hour}`;
    if (toggles[key] !== undefined) return toggles[key];
    const slots = data.availability[dateStr] || [];
    const { startTime } = slotToUTC(dateStr, hour);
    return slots.some((s) => s.startTime.slice(0, 13) === startTime.slice(0, 13));
  };

  const isSlotDisabled = (dateStr, hour) => {
    if (isPastDate(dateStr)) return true;
    const utcTodayStr = new Date().toISOString().slice(0, 10);
    if (dateStr === utcTodayStr) {
      const { startTime } = slotToUTC(dateStr, hour);
      return isPastDateTime(startTime);
    }
    return false;
  };

  const toggleSlot = (dateStr, hour) => {
    if (isSlotDisabled(dateStr, hour)) return;
    const key = `${dateStr}-${hour}`;
    setToggles((prev) => ({ ...prev, [key]: !isSlotEnabled(dateStr, hour) }));
  };

  const saveBatch = async () => {
    setSaving(true);
    setAvError("");
    const slots = [];
    data.dates.forEach((dateStr) => {
      HOURS.forEach((hour) => {
        const key = `${dateStr}-${hour}`;
        if (toggles[key] === undefined) return;
        const { startTime, endTime } = slotToUTC(dateStr, hour);
        slots.push({ date: dateStr, startTime, endTime, enabled: toggles[key] });
      });
    });
    if (!slots.length) { setSaving(false); return; }
    try {
      await availabilityApi.saveBatch(slots);
      await fetchWeekly();
      setToggles({});
    } catch (e) {
      setAvError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const confirmSingleSlot = async (dateStr, hour) => {
    const { startTime, endTime } = slotToUTC(dateStr, hour);
    setSaving(true);
    try {
      await availabilityApi.saveBatch([{ date: dateStr, startTime, endTime, enabled: true }]);
      await fetchWeekly();
    } catch (e) {
      setAvError(e.message || "Failed to save slot");
    } finally {
      setSaving(false);
    }
  };

  const formatTimeLabel = (utcHour) => {
    const s = new Date(Date.UTC(2000, 0, 1, utcHour, 0)).toISOString();
    const e = new Date(Date.UTC(2000, 0, 1, utcHour + 1, 0)).toISOString();
    return formatTimeRange(`${formatTimeLocal(s, displayTimezone)} – ${formatTimeLocal(e, displayTimezone)}`);
  };

  const hasChanges = Object.keys(toggles).length > 0;

  // ── Profile helpers ─────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg("");
    try {
      await authApi.updateProfile({ tags, description });
      await refreshUser();
      setProfileMsg("✅ Profile saved!");
    } catch (e) {
      setProfileMsg(`❌ ${e.message || "Failed to save"}`);
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(""), 3000);
    }
  };

  // ── Meetings helpers ────────────────────────────────────────
  const fetchMeetings = useCallback(async () => {
    setMeetLoading(true);
    try {
      const data = await getMyMeetings();
      setMeetings(Array.isArray(data) ? data : []);
    } catch { setMeetings([]); }
    finally { setMeetLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "meetings") fetchMeetings();
  }, [activeTab, fetchMeetings]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {user?.name}
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage your availability so admins can schedule your calls.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <TabButton id="availability" label="Availability" icon="📅" active={activeTab === "availability"} onClick={setActiveTab} />
          <TabButton id="profile"      label="Profile"      icon="👤" active={activeTab === "profile"}      onClick={setActiveTab} />
          <TabButton id="meetings"     label="My Calls"     icon="📞" active={activeTab === "meetings"}     onClick={setActiveTab} />
        </div>
      </div>

      {/* ── AVAILABILITY TAB ──────────────────────────────────── */}
      {activeTab === "availability" && (
        <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm animate-fade-in-up">
          {/* Controls bar */}
          <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-400 font-medium">Timezone</label>
              <select
                value={displayTimezone}
                onChange={(e) => setDisplayTimezone(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-800 text-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3">
              {/* Week navigation */}
              <button
                onClick={() => setWeekOffset((p) => Math.max(0, p - 1))}
                disabled={weekOffset === 0}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >←</button>
              <span className="text-slate-400 text-sm font-medium whitespace-nowrap">
                Week of {formatDateLocal(gridDates[0], displayTimezone)}
              </span>
              <button
                onClick={() => setWeekOffset((p) => p + 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 transition"
              >→</button>

              {hasChanges && (
                <>
                  <button
                    onClick={() => setToggles({})}
                    className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-sm hover:bg-slate-800 transition"
                  >Cancel</button>
                  <button
                    onClick={saveBatch}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >{saving ? "Saving…" : "Save"}</button>
                </>
              )}
            </div>
          </div>

          {avError && (
            <div className="mx-4 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{avError}</div>
          )}

          {/* Grid */}
          <div className="overflow-auto max-h-[65vh] p-1">
            {avLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs w-28">Time ({displayTimezone})</th>
                    {gridDates.map((d) => (
                      <th key={d} className="py-3 px-2 text-center">
                        <span className="block text-xs font-semibold text-white">{formatDateLocal(d, displayTimezone)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour} className="border-b border-slate-800/50 hover:bg-white/2 transition-colors">
                      <td className="py-1.5 px-3 text-slate-500 text-xs font-medium">{formatTimeLabel(hour)}</td>
                      {gridDates.map((dateStr) => {
                        const enabled = isSlotEnabled(dateStr, hour);
                        const disabled = isSlotDisabled(dateStr, hour);
                        return (
                          <td key={dateStr} className="p-1">
                            <button
                              type="button"
                              onClick={() => toggleSlot(dateStr, hour)}
                              disabled={disabled}
                              className={`w-full py-1.5 rounded-lg border font-medium text-xs uppercase tracking-wide transition-all duration-200
                                ${disabled ? "bg-slate-800/30 border-slate-800/50 cursor-not-allowed opacity-30 text-slate-600" : ""}
                                ${!disabled && enabled  ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-500/30" : ""}
                                ${!disabled && !enabled ? "bg-slate-800/50 border-slate-700/50 text-slate-600 hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-slate-400" : ""}
                              `}
                            >
                              {enabled ? "✓" : "–"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-white/5 flex gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-600" /> Available</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-slate-800" /> Not set</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-slate-800 opacity-30" /> Past</div>
          </div>
        </div>
      )}

      {/* ── PROFILE TAB ───────────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="max-w-2xl animate-fade-in-up">
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white">Your Profile</h2>
            <p className="text-slate-400 text-sm -mt-4">
              Add tags and a description so admins can find the best mentor for you.
            </p>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Your Tags</label>
              <div className="flex flex-wrap gap-2 mb-3 min-h-8">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                    {tag}
                    <button
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="ml-1.5 text-indigo-400 hover:text-red-400 transition-colors"
                    >×</button>
                  </span>
                ))}
                {tags.length === 0 && <span className="text-slate-600 text-xs italic">No tags yet</span>}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="Add tag (e.g. tech, frontend, good-communication)"
                />
                <button onClick={addTag} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition">
                  Add
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">Common tags: tech, non-tech, frontend, backend, data-science, good-communication, big-tech, career-switch</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-slate-500 text-sm bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                placeholder="Describe your background, goals, and what kind of mentoring you're looking for…"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-300 bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60"
              >
                {profileSaving ? "Saving…" : "Save Profile"}
              </button>
              {profileMsg && <span className="text-sm text-slate-300">{profileMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── MEETINGS TAB ─────────────────────────────────────────*/}
      {activeTab === "meetings" && (
        <div className="animate-fade-in-up">
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Your Scheduled Calls</h2>
            <p className="text-slate-400 text-sm mb-6">Calls booked for you by the admin.</p>

            {meetLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-400 font-medium">No calls scheduled yet.</p>
                <p className="text-slate-600 text-sm mt-1">Set your availability and the admin will book a call for you.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((m) => {
                  const ct = CALL_TYPE_LABELS[m.callType] || { label: m.callType, icon: "📞", color: "text-slate-300 bg-slate-700/30 border-slate-600/30" };
                  const start = new Date(m.startTime);
                  const end = new Date(m.endTime);
                  return (
                    <div key={m.id} className="rounded-xl border border-white/8 bg-white/3 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl mt-0.5">{ct.icon}</div>
                        <div>
                          <h3 className="text-white font-semibold">{m.title}</h3>
                          <p className="text-slate-400 text-sm mt-0.5">
                            with <span className="text-indigo-400 font-medium">{m.mentor?.name}</span>
                          </p>
                          <p className="text-slate-500 text-xs mt-1">
                            {start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} ·{" "}
                            {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} –{" "}
                            {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ct.color} whitespace-nowrap self-start sm:self-center`}>
                        {ct.icon} {ct.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

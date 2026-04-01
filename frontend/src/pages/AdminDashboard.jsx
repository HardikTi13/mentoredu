import { useState, useEffect, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import { useAuth } from "../context/AuthContext";
import * as adminApi from "../api/admin";
import * as availabilityApi from "../api/availability";
import { listMeetings, deleteMeeting } from "../api/meetings";
import { formatTimeRange, formatTimeLocal } from "../utils/time";

// ─── Constants ───────────────────────────────────────────────────────────────
const CALL_TYPES = [
  { value: "RESUME_REVAMP",       label: "Resume Revamp",       icon: "📄", desc: "Best for big-tech mentors with senior dev background" },
  { value: "JOB_MARKET_GUIDANCE", label: "Job Market Guidance", icon: "💼", desc: "Best for mentors with strong communication skills" },
  { value: "MOCK_INTERVIEW",      label: "Mock Interview",       icon: "🎤", desc: "Best for domain-matching mentors from same field" },
];

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "GMT (GMT+0)", iana: "Europe/Dublin" },
  { value: "IST", label: "IST (GMT+5:30)", iana: "Asia/Kolkata" },
];

// ─── Small components ─────────────────────────────────────────────────────────
function TabButton({ id, label, icon, active, onClick, badge }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 relative ${
        active
          ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25"
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
      }`}
    >
      {icon} {label}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? "from-emerald-500 to-teal-500" :
                score >= 40 ? "from-amber-500 to-orange-500" :
                              "from-red-500 to-rose-500";
  return (
    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
      {score}
    </div>
  );
}

function TagBadge({ tag, color = "indigo" }) {
  const colors = {
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/20",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.indigo}`}>
      {tag}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState("schedule");

  // Data
  const [users, setUsers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Schedule flow state
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCallType, setSelectedCallType] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [overlapData, setOverlapData] = useState(null);
  const [overlapLoading, setOverlapLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [displayTimezone, setDisplayTimezone] = useState("UTC");

  // Schedule form
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");

  // Mentor edit modal
  const [editMentor, setEditMentor] = useState(null);
  const [editTags, setEditTags] = useState([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete meeting
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // User details panel
  const [viewUser, setViewUser] = useState(null);

  const tzIana = TIMEZONE_OPTIONS.find((t) => t.value === displayTimezone)?.iana || "Europe/Dublin";

  // ── Load initial data ───────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [u, m, ml] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listMentors(),
        listMeetings(),
      ]);
      setUsers(u);
      setMentors(m);
      setMeetings(Array.isArray(ml) ? ml : []);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Get recommendations ─────────────────────────────────────
  useEffect(() => {
    if (!selectedUser || !selectedCallType) {
      setRecommendations([]);
      setSelectedMentor(null);
      setOverlapData(null);
      setSelectedSlot(null);
      return;
    }
    setRecLoading(true);
    adminApi.getRecommendations(selectedUser.id, selectedCallType)
      .then((res) => setRecommendations(res.recommendations || []))
      .catch(() => setRecommendations([]))
      .finally(() => setRecLoading(false));
  }, [selectedUser?.id, selectedCallType]);

  // Auto-generate title when user+mentor selected
  useEffect(() => {
    if (selectedUser && selectedMentor && selectedCallType) {
      const ctLabel = CALL_TYPES.find((c) => c.value === selectedCallType)?.label || selectedCallType;
      setScheduleTitle(`${ctLabel} — ${selectedUser.name} & ${selectedMentor.name}`);
    }
  }, [selectedUser?.id, selectedMentor?.id, selectedCallType]);

  // ── Get overlap when mentor selected ───────────────────────
  useEffect(() => {
    if (!selectedUser || !selectedMentor) {
      setOverlapData(null);
      setSelectedSlot(null);
      return;
    }
    setOverlapLoading(true);
    adminApi.getOverlapSlots(selectedUser.id, selectedMentor.id)
      .then(setOverlapData)
      .catch(() => setOverlapData(null))
      .finally(() => setOverlapLoading(false));
  }, [selectedUser?.id, selectedMentor?.id]);

  // ── Schedule meeting ────────────────────────────────────────
  const handleSchedule = async () => {
    setScheduleError("");
    setScheduleSuccess("");
    if (!selectedUser || !selectedMentor || !selectedCallType) {
      setScheduleError("Please select a user, call type, and mentor.");
      return;
    }
    if (!selectedSlot) {
      setScheduleError("Please select an available time slot.");
      return;
    }
    if (!scheduleTitle.trim()) {
      setScheduleError("Meeting title is required.");
      return;
    }
    setScheduleLoading(true);
    try {
      await adminApi.scheduleMeeting({
        title: scheduleTitle.trim(),
        callType: selectedCallType,
        userId: selectedUser.id,
        mentorId: selectedMentor.id,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        notes: scheduleNotes || null,
      });
      setScheduleSuccess(`✅ Meeting scheduled successfully!`);
      setSelectedSlot(null);
      setScheduleNotes("");
      await loadAll();
      setTimeout(() => setScheduleSuccess(""), 4000);
    } catch (e) {
      setScheduleError(e.message || "Failed to schedule meeting");
    } finally {
      setScheduleLoading(false);
    }
  };

  // ── Delete meeting ──────────────────────────────────────────
  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    setDeletingId(meetingToDelete);
    try {
      await deleteMeeting(meetingToDelete);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingToDelete));
      setMeetingToDelete(null);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Edit mentor metadata ────────────────────────────────────
  const openEditMentor = (mentor) => {
    setEditMentor(mentor);
    setEditTags([...mentor.tags]);
    setEditDesc(mentor.description || "");
    setEditTagInput("");
    setEditError("");
  };

  const saveEditMentor = async () => {
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await adminApi.updateMentorMetadata(editMentor.id, {
        tags: editTags,
        description: editDesc,
      });
      setMentors((prev) => prev.map((m) => m.id === updated.id ? { ...m, ...updated } : m));
      setEditMentor(null);
    } catch (e) {
      setEditError(e.message || "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Format helpers ──────────────────────────────────────────
  const formatSlotTime = (iso) => {
    return DateTime.fromISO(iso, { zone: "utc" }).setZone(tzIana).toFormat("h:mm a");
  };

  const formatSlotDate = (iso) => {
    return DateTime.fromISO(iso, { zone: "utc" }).setZone(tzIana).toFormat("ccc, MMM d");
  };

  // Group overlaps by date
  const overlapByDate = useMemo(() => {
    if (!overlapData?.overlaps?.length) return {};
    const byDate = {};
    overlapData.overlaps.forEach((slot) => {
      const dateKey = DateTime.fromISO(slot.startTime, { zone: "utc" }).setZone(tzIana).toFormat("yyyy-MM-dd");
      const label = formatSlotDate(slot.startTime);
      if (!byDate[dateKey]) byDate[dateKey] = { label, slots: [] };
      byDate[dateKey].slots.push(slot);
    });
    return byDate;
  }, [overlapData, tzIana]);

  // Group meetings by date
  const meetingsByDate = useMemo(() => {
    const byDate = {};
    meetings.forEach((m) => {
      if (!m.startTime) return;
      const key = DateTime.fromISO(m.startTime, { zone: "utc" }).setZone(tzIana).toFormat("yyyy-MM-dd");
      const label = formatSlotDate(m.startTime);
      if (!byDate[key]) byDate[key] = { label, items: [] };
      byDate[key].items.push(m);
    });
    return byDate;
  }, [meetings, tzIana]);

  const callTypeLabel = CALL_TYPES.find((c) => c.value === selectedCallType);

  if (loadingData) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="animate-spin h-10 w-10 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Admin Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage users, mentors, and schedule mentoring calls — logged in as <span className="text-amber-400">{authUser?.email}</span>
          </p>
        </div>

        {/* Stats chips */}
        <div className="flex gap-3 flex-wrap">
          <div className="px-4 py-2 rounded-xl border border-white/8 bg-white/3 text-center">
            <div className="text-2xl font-bold text-white">{users.length}</div>
            <div className="text-xs text-slate-500">Users</div>
          </div>
          <div className="px-4 py-2 rounded-xl border border-white/8 bg-white/3 text-center">
            <div className="text-2xl font-bold text-white">{mentors.length}</div>
            <div className="text-xs text-slate-500">Mentors</div>
          </div>
          <div className="px-4 py-2 rounded-xl border border-white/8 bg-white/3 text-center">
            <div className="text-2xl font-bold text-white">{meetings.length}</div>
            <div className="text-xs text-slate-500">Meetings</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabButton id="schedule"  label="Schedule"       icon="📅" active={activeTab === "schedule"}  onClick={setActiveTab} />
        <TabButton id="users"     label="Users"          icon="👤" active={activeTab === "users"}     onClick={setActiveTab} badge={users.length} />
        <TabButton id="mentors"   label="Mentors"        icon="🧑‍🏫" active={activeTab === "mentors"}   onClick={setActiveTab} badge={mentors.length} />
        <TabButton id="meetings"  label="All Meetings"   icon="📞" active={activeTab === "meetings"}  onClick={setActiveTab} badge={meetings.length} />
      </div>

      {/* ══════════════════════════════════════════════════════════
           TAB 1: SCHEDULE (main workflow)
         ══════════════════════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <div className="space-y-6">
          {/* Step 1: Select User + Call Type */}
          <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">1</span>
              Select User & Call Type
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {/* User dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">User</label>
                <select
                  value={selectedUser?.id || ""}
                  onChange={(e) => {
                    const u = users.find((x) => x.id === e.target.value) || null;
                    setSelectedUser(u);
                    setSelectedMentor(null);
                    setOverlapData(null);
                    setSelectedSlot(null);
                    if (u) setViewUser(u);
                  }}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 text-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                >
                  <option value="">— Select a user —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Display Timezone</label>
                <select
                  value={displayTimezone}
                  onChange={(e) => setDisplayTimezone(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 text-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                  {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* User profile card */}
            {selectedUser && (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{selectedUser.name}</div>
                    <div className="text-slate-400 text-sm">{selectedUser.email}</div>
                    {selectedUser.description && (
                      <p className="text-slate-300 text-sm mt-2 leading-relaxed">{selectedUser.description}</p>
                    )}
                    {selectedUser.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedUser.tags.map((t) => <TagBadge key={t} tag={t} color="amber" />)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Call Type selector */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">Call Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CALL_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setSelectedCallType(ct.value)}
                    className={`p-4 rounded-xl border text-left transition-all duration-300 ${
                      selectedCallType === ct.value
                        ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20"
                        : "border-white/8 bg-white/3 hover:border-amber-500/40 hover:bg-amber-500/5"
                    }`}
                  >
                    <div className="text-2xl mb-2">{ct.icon}</div>
                    <div className="font-semibold text-white text-sm">{ct.label}</div>
                    <div className="text-slate-500 text-xs mt-1">{ct.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2: AI Recommendations */}
          {selectedUser && selectedCallType && (
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
              <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">2</span>
                AI Mentor Recommendations
                <span className="text-xs text-slate-500 font-normal ml-1">for {callTypeLabel?.label}</span>
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                Ranked by tag similarity, call-type match, and profile alignment. Select the best fit.
              </p>

              {recLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No mentor data available. Seed the database first.</div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={rec.mentor.id}
                      onClick={() => {
                        setSelectedMentor(rec.mentor);
                        setOverlapData(null);
                        setSelectedSlot(null);
                      }}
                      className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                        selectedMentor?.id === rec.mentor.id
                          ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20"
                          : "border-white/8 bg-white/3 hover:border-amber-500/40 hover:bg-amber-500/5"
                      }`}
                    >
                      {/* Rank */}
                      <div className="flex-shrink-0">
                        <div className="text-xs text-slate-600 font-medium mb-1 text-center">#{idx + 1}</div>
                        <ScoreBadge score={rec.score} />
                        <div className="text-xs text-slate-600 text-center mt-1">score</div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{rec.mentor.name}</span>
                          <span className="text-slate-500 text-xs">{rec.mentor.email}</span>
                          {selectedMentor?.id === rec.mentor.id && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">Selected</span>
                          )}
                        </div>

                        {rec.mentor.description && (
                          <p className="text-slate-400 text-xs mt-1.5 line-clamp-2">{rec.mentor.description}</p>
                        )}

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rec.mentor.tags.map((t) => (
                            <span
                              key={t}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                rec.matchedTags.includes(t)
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-slate-800/60 text-slate-400 border border-slate-700/50"
                              }`}
                            >
                              {rec.matchedTags.includes(t) ? "✓ " : ""}{t}
                            </span>
                          ))}
                        </div>

                        {/* Reasons */}
                        {rec.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {rec.reasons.map((r) => (
                              <span key={r} className="text-xs text-slate-500 flex items-center gap-1">
                                <span className="text-amber-500">•</span> {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Score breakdown */}
                      <div className="flex-shrink-0 hidden sm:block">
                        <div className="space-y-1 text-right">
                          <div className="text-xs text-slate-600">
                            Tags <span className="text-slate-400">{rec.breakdown.tagMatch}%</span>
                          </div>
                          <div className="text-xs text-slate-600">
                            Call type <span className="text-slate-400">{rec.breakdown.callTypeMatch}%</span>
                          </div>
                          <div className="text-xs text-slate-600">
                            Profile <span className="text-slate-400">{rec.breakdown.descriptionMatch}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Availability Overlap */}
          {selectedMentor && (
            <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm p-6">
              <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">3</span>
                Available Time Slots
                <span className="text-xs text-slate-500 font-normal ml-1">
                  {selectedUser?.name} ↔ {selectedMentor.name} · {displayTimezone}
                </span>
              </h2>
              <p className="text-slate-400 text-sm mb-5">
                Green slots are when both <span className="text-white font-medium">{selectedUser?.name}</span> and{" "}
                <span className="text-white font-medium">{selectedMentor.name}</span> are free. Click to select.
              </p>

              {overlapLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                </div>
              ) : Object.keys(overlapByDate).length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-white/5 bg-white/2">
                  <div className="text-3xl mb-2">😕</div>
                  <p className="text-slate-400 font-medium">No overlapping availability found</p>
                  <p className="text-slate-600 text-sm mt-1">Ask the user and mentor to add more availability slots.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(overlapByDate).map(([dateKey, { label, slots }]) => (
                    <div key={dateKey}>
                      <div className="text-sm font-medium text-slate-300 mb-2">{label}</div>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((slot) => {
                          const isSelected = selectedSlot?.startTime === slot.startTime;
                          return (
                            <button
                              key={slot.startTime}
                              type="button"
                              onClick={() => setSelectedSlot(isSelected ? null : slot)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                                isSelected
                                  ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                              }`}
                            >
                              {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Book the call */}
          {selectedSlot && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm p-6">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">4</span>
                Book the Call
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/8">
                  <div className="text-xs text-slate-500 mb-1">Selected slot</div>
                  <div className="text-white font-medium">{formatSlotDate(selectedSlot.startTime)}</div>
                  <div className="text-slate-300 text-sm">
                    {formatSlotTime(selectedSlot.startTime)} – {formatSlotTime(selectedSlot.endTime)} ({displayTimezone})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/8">
                  <div className="text-xs text-slate-500 mb-1">Call details</div>
                  <div className="text-white font-medium">{callTypeLabel?.icon} {callTypeLabel?.label}</div>
                  <div className="text-slate-300 text-sm">{selectedUser?.name} ↔ {selectedMentor?.name}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Meeting Title</label>
                  <input
                    type="text"
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 text-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 text-sm"
                    placeholder="Meeting title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Notes (optional)</label>
                  <textarea
                    value={scheduleNotes}
                    onChange={(e) => setScheduleNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 text-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 text-sm resize-none"
                    placeholder="Any notes for this session…"
                  />
                </div>

                {scheduleError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{scheduleError}</div>
                )}
                {scheduleSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">{scheduleSuccess}</div>
                )}

                <button
                  onClick={handleSchedule}
                  disabled={scheduleLoading}
                  className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {scheduleLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Booking…
                    </span>
                  ) : "📅 Book This Call"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           TAB 2: USERS
         ══════════════════════════════════════════════════════════ */}
      {activeTab === "users" && (
        <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h2 className="text-base font-semibold text-white">All Users ({users.length})</h2>
            <p className="text-slate-400 text-sm mt-0.5">View user profiles, tags, and requirements.</p>
          </div>
          <div className="divide-y divide-white/5">
            {users.map((u) => (
              <div key={u.id} className="p-4 hover:bg-white/3 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{u.name}</span>
                      <span className="text-slate-500 text-xs">{u.email}</span>
                    </div>
                    {u.description && (
                      <p className="text-slate-400 text-sm mt-1.5 line-clamp-2">{u.description}</p>
                    )}
                    {u.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {u.tags.map((t) => <TagBadge key={t} tag={t} color="indigo" />)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUser(u);
                      setActiveTab("schedule");
                    }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 hover:bg-amber-500/30 transition-colors whitespace-nowrap"
                  >
                    Schedule Call →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           TAB 3: MENTORS
         ══════════════════════════════════════════════════════════ */}
      {activeTab === "mentors" && (
        <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h2 className="text-base font-semibold text-white">All Mentors ({mentors.length})</h2>
            <p className="text-slate-400 text-sm mt-0.5">Manage mentor metadata — tags and descriptions used for AI matching.</p>
          </div>
          <div className="divide-y divide-white/5">
            {mentors.map((m) => (
              <div key={m.id} className="p-4 hover:bg-white/3 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{m.name}</span>
                      <span className="text-slate-500 text-xs">{m.email}</span>
                    </div>
                    {m.description && (
                      <p className="text-slate-400 text-sm mt-1.5 line-clamp-2">{m.description}</p>
                    )}
                    {m.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.tags.map((t) => <TagBadge key={t} tag={t} color="emerald" />)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => openEditMentor(m)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors whitespace-nowrap"
                  >
                    ✏️ Edit Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           TAB 4: ALL MEETINGS
         ══════════════════════════════════════════════════════════ */}
      {activeTab === "meetings" && (
        <div className="rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">All Meetings ({meetings.length})</h2>
              <p className="text-slate-400 text-sm mt-0.5">All scheduled mentoring calls.</p>
            </div>
            <select
              value={displayTimezone}
              onChange={(e) => setDisplayTimezone(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-800 text-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {meetings.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-slate-400">No meetings scheduled yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {Object.entries(meetingsByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dateKey, { label, items }]) => (
                  <div key={dateKey}>
                    <div className="px-5 py-2 bg-white/2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {label}
                    </div>
                    {items.map((m) => {
                      const ct = { RESUME_REVAMP: "📄", JOB_MARKET_GUIDANCE: "💼", MOCK_INTERVIEW: "🎤" };
                      return (
                        <div key={m.id} className="px-5 py-3 hover:bg-white/3 transition-colors flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{ct[m.callType] || "📞"}</span>
                            <div>
                              <div className="text-white font-medium text-sm">{m.title}</div>
                              <div className="text-slate-500 text-xs mt-0.5">
                                {m.user?.name} ↔ {m.mentor?.name} ·{" "}
                                {formatSlotTime(m.startTime)} – {formatSlotTime(m.endTime)} {displayTimezone}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setMeetingToDelete(m.id)}
                            className="px-2 py-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-xs border border-transparent hover:border-red-500/20 flex-shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           MODAL: Edit Mentor Metadata
         ══════════════════════════════════════════════════════════ */}
      {editMentor && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setEditMentor(null)}
        >
          <div
            className="rounded-2xl bg-slate-900 border border-white/10 shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Edit Mentor — {editMentor.name}</h3>
            <p className="text-slate-400 text-sm -mt-2">You control this mentor's tags and description for AI matching.</p>

            {editError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{editError}</div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
                {editTags.map((t) => (
                  <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                    {t}
                    <button onClick={() => setEditTags(editTags.filter((x) => x !== t))} className="ml-1 text-slate-400 hover:text-red-400">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = editTagInput.trim().toLowerCase().replace(/\s+/g, "-");
                      if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
                      setEditTagInput("");
                    }
                  }}
                  placeholder="Add tag (Enter to add)"
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                <button
                  onClick={() => {
                    const t = editTagInput.trim().toLowerCase().replace(/\s+/g, "-");
                    if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
                    setEditTagInput("");
                  }}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
                >Add</button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={4}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                placeholder="Describe the mentor's background, expertise, and strengths…"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditMentor(null)} className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition">
                Cancel
              </button>
              <button
                onClick={saveEditMentor}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
           MODAL: Delete Meeting Confirmation
         ══════════════════════════════════════════════════════════ */}
      {meetingToDelete && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !deletingId && setMeetingToDelete(null)}
        >
          <div
            className="rounded-2xl bg-slate-900 border border-white/10 shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Delete Meeting?</h3>
            <p className="text-slate-400 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setMeetingToDelete(null)}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
              >Cancel</button>
              <button
                onClick={handleDeleteMeeting}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-lg bg-red-600 border border-red-500 text-white text-sm font-medium hover:bg-red-500 transition disabled:opacity-50"
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

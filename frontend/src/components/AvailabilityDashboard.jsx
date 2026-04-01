import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import * as availabilityApi from "../api/availability";
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

const ROLE_HEADINGS = {
  USER: "User Dashboard",
  MENTOR: "Mentor Dashboard",
};

export default function AvailabilityDashboard({ role = "USER" }) {
  const { user } = useAuth();
  const [displayTimezone, setDisplayTimezone] = useState(user?.timezone || "UTC");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = today..today+6, 1 = +7..+13, etc.
  const [data, setData] = useState({ dates: [], availability: {} });
  const [loading, setLoading] = useState(!user); // only show loading if no user yet
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState({});
  const [error, setError] = useState("");

  const [selectorDate, setSelectorDate] = useState("");
  const [selectorHour, setSelectorHour] = useState(0);

  const fetchWeekly = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const today = new Date();
      const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      base.setUTCDate(base.getUTCDate() + weekOffset * 7);
      const weekStartStr = base.toISOString().slice(0, 10);
      const res = await availabilityApi.getWeekly({ weekStart: weekStartStr });
      setData(res);
      // DO NOT call setToggles({}) here
    } catch (e) {
      setError(e.message || "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [weekOffset, user?.id]);

  useEffect(() => {
    setToggles({});
  }, [weekOffset]);

  useEffect(() => {
    if (user) fetchWeekly();
  }, [fetchWeekly]);

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
    setError("");
    const slots = [];
    data.dates.forEach((dateStr) => {
      HOURS.forEach((hour) => {
        const key = `${dateStr}-${hour}`;
        if (toggles[key] === undefined) return;
        const enabled = toggles[key];
        const { startTime, endTime } = slotToUTC(dateStr, hour);
        slots.push({
          date: dateStr,
          startTime,
          endTime,
          enabled,
        });
      });
    });
    if (slots.length === 0) {
      setSaving(false);
      return;
    }
    try {
      await availabilityApi.saveBatch(slots);
      await fetchWeekly();
      setToggles({});
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(toggles).length > 0;

  // Visible 7-day window: always today + weekOffset * 7, forward only
  const buildGridDates = () => {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() + weekOffset * 7);
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  };

  const gridDates = buildGridDates();
  const gridStart = gridDates[0];

  const prevWeek = () => {
    if (weekOffset === 0) return; // do not navigate into the past
    setWeekOffset((prev) => Math.max(0, prev - 1));
  };
  const nextWeek = () => {
    setWeekOffset((prev) => prev + 1);
  };

  const weekMin = gridDates[0] || "";
  const weekMax = gridDates[6] || "";

  const isSelectorSlotDisabled =
    selectorDate !== "" && isSlotDisabled(selectorDate, selectorHour);

  const confirmSelectorSlot = async () => {
    if (!selectorDate || isSelectorSlotDisabled) return;

    const { startTime, endTime } = slotToUTC(selectorDate, selectorHour);

    setSaving(true);
    setError("");
    try {
      await availabilityApi.saveBatch([
        {
          date: selectorDate,
          startTime,
          endTime,
          enabled: true,
        },
      ]);
      await fetchWeekly();
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const cancelChanges = () => {
    setToggles({});
  };

  const formatTimeOptionLabel = (utcHourIndex) => {
    const startISO = new Date(Date.UTC(2000, 0, 1, utcHourIndex, 0)).toISOString();
    const endISO = new Date(Date.UTC(2000, 0, 1, utcHourIndex + 1, 0)).toISOString();
    const start = formatTimeLocal(startISO, displayTimezone);
    const end = formatTimeLocal(endISO, displayTimezone);
    return formatTimeRange(`${start} – ${end}`);
  };

  const heading = ROLE_HEADINGS[role] ?? ROLE_HEADINGS.USER;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">{heading}</h1>
        <p className="text-slate-400 font-medium">Manage your availability.</p>
      </header>

      {error && (
        <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <section className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
          <div className="w-full md:w-40">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Timezone</label>
            <select
              value={displayTimezone}
              onChange={(e) => setDisplayTimezone(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 text-white font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Date</label>
            <input
              type="date"
              value={selectorDate}
              min={weekMin}
              max={weekMax}
              onChange={(e) => setSelectorDate(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 text-white font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark] appearance-none"
            />
          </div>
          <div className="w-full md:w-52">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Time</label>
            <select
              value={selectorHour}
              onChange={(e) => setSelectorHour(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 text-white font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-[12rem] overflow-y-auto"
            >
              {HOURS.map((utcHourIndex) => {
                const disabled = selectorDate ? isSlotDisabled(selectorDate, utcHourIndex) : false;
                return (
                  <option key={utcHourIndex} value={utcHourIndex} disabled={disabled}>
                    {formatTimeOptionLabel(utcHourIndex)}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            type="button"
            onClick={confirmSelectorSlot}
            disabled={!selectorDate || isSelectorSlotDisabled || saving}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {saving ? "Saving..." : "Confirm / Save"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Your availability</h2>
            <p className="text-slate-400 font-medium text-sm mt-0.5">
              Click slots to toggle availability. Save when done.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancelChanges}
              disabled={!hasChanges}
              className="rounded-lg border border-slate-600 bg-transparent text-slate-300 font-medium px-5 py-2.5 hover:bg-slate-800 hover:border-slate-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveBatch}
              disabled={saving || !hasChanges}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Availability"}
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4 mb-6">
          <button
            type="button"
            onClick={prevWeek}
            disabled={weekOffset === 0}
            className={`rounded-full w-9 h-9 flex items-center justify-center border border-slate-700 bg-slate-800/50 text-slate-300 font-medium transition shrink-0 ${
              weekOffset === 0
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-slate-800 hover:border-slate-600"
            }`}
            aria-label="Previous week"
          >
            ←
          </button>
          <span className="text-slate-400 font-medium text-sm text-center">
            Week of {formatDateLocal(gridStart, displayTimezone)}
          </span>
          <button
            type="button"
            onClick={nextWeek}
            className="rounded-full w-9 h-9 flex items-center justify-center border border-slate-700 bg-slate-800/50 text-slate-300 font-medium hover:bg-slate-800 hover:border-slate-600 transition shrink-0"
            aria-label="Next week"
          >
            →
          </button>
        </div>

        <div className="overflow-x-auto -mx-1 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium">Loading...</div>
          ) : (
            <table className="w-full min-w-[800px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-4 px-3 text-slate-400 font-medium text-sm w-28">Time</th>
                  {gridDates.map((d) => (
                    <th key={d} className="py-4 px-3 text-white font-medium text-sm">
                      {formatDateLocal(d, displayTimezone)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-slate-800/80">
                    <td className="py-2 px-3 text-slate-400 font-medium text-xs">
                      {formatTimeOptionLabel(hour)}
                    </td>
                    {gridDates.map((dateStr) => {
                      const enabled = isSlotEnabled(dateStr, hour);
                      const disabled = isSlotDisabled(dateStr, hour);
                      return (
                        <td key={dateStr} className="p-2">
                          <button
                            type="button"
                            onClick={() => toggleSlot(dateStr, hour)}
                            disabled={disabled}
                            className={`
                              w-full py-2 rounded-lg border font-medium text-xs uppercase tracking-wide transition
                              ${disabled
                                ? "bg-slate-800/50 border-slate-800 cursor-not-allowed opacity-40 text-slate-500"
                                : ""}
                              ${!disabled && enabled
                                ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-500"
                                : ""}
                              ${!disabled && !enabled
                                ? "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:bg-slate-800/80"
                                : ""}
                            `}
                          >
                            {enabled ? "AVAILABLE" : "Off"}
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
      </section>
    </div>
  );
}

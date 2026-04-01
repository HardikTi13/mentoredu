import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";
import {
  isPastDateOnly,
  isPastTime,
  normalizeSlot,
  getWeekStart,
  getWeekDates,
  getSlotsForDate,
  parseDateUTC,
} from "../utils/time.js";

export async function getWeekly(req, res, next) {
  try {
    const { userId: targetUserId, mentorId, weekStart } = req.query;
    const callerId = req.userId;
    const callerRole = req.userRole;

    const hasUserId = targetUserId != null && String(targetUserId).trim() !== "";
    const hasMentorId = mentorId != null && String(mentorId).trim() !== "";

    let where = {};
    let requestedUserId = null;
    let requestedMentorId = null;

    if (hasUserId && !hasMentorId) {
      where.userId = String(targetUserId).trim();
      where.role = "USER";
      requestedUserId = where.userId;
    } else if (hasMentorId && !hasUserId) {
      where.mentorId = String(mentorId).trim();
      where.role = "MENTOR";
      requestedMentorId = where.mentorId;
    } else if (!hasUserId && !hasMentorId) {
      if (callerRole === "MENTOR") {
        where.mentorId = callerId;
        where.role = "MENTOR";
        requestedMentorId = callerId;
      } else {
        where.userId = callerId;
        where.role = "USER";
        requestedUserId = callerId;
      }
    } else {
      return res.status(400).json({ error: "Pass either userId or mentorId, not both" });
    }

    const isOwnRequest =
      (requestedUserId === callerId && !requestedMentorId) ||
      (requestedMentorId === callerId && !requestedUserId);
    if (!isOwnRequest && callerRole !== "ADMIN") {
      return res.status(403).json({ error: "Cannot view another user's availability" });
    }

    let start;
    if (weekStart) {
      start = new Date(weekStart);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      start = getWeekStart(new Date());
    }

    const weekDates = getWeekDates(start);
    const dateStrs = weekDates.map((d) => d.toISOString().slice(0, 10));
    where.date = { in: weekDates.map((d) => new Date(d.toISOString().slice(0, 10))) };

    const slots = await prisma.availability.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const byDate = {};
    dateStrs.forEach((d) => (byDate[d] = []));
    slots.forEach((s) => {
      const d = s.date.toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({
        id: s.id,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      });
    });

    res.json({
      weekStart: start.toISOString().slice(0, 10),
      dates: dateStrs,
      availability: byDate,
    });
  } catch (e) {
    next(e);
  }
}

export async function saveBatch(req, res, next) {
  try {
    const { slots } = req.body;
    const callerId = req.userId;
    const role = req.userRole;
    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: "slots array required" });
    }

    const toCreate = [];
    const toDelete = [];

    for (const slot of slots) {
      const { date, startTime, endTime, enabled } = slot;
      const targetUserId = slot.userId;
      const targetMentorId = slot.mentorId;

      let saveAsUserId = null;
      let saveAsMentorId = null;
      let saveRole = "USER";
      if (role === "ADMIN") {
        if (targetMentorId != null && String(targetMentorId).trim() !== "") {
          saveAsMentorId = String(targetMentorId).trim();
          saveRole = "MENTOR";
        } else {
          saveAsUserId = (targetUserId != null && String(targetUserId).trim() !== "")
            ? String(targetUserId).trim()
            : callerId;
          saveRole = "USER";
        }
      } else if (role === "MENTOR") {
        saveAsMentorId = callerId;
        saveRole = "MENTOR";
      } else {
        saveAsUserId = callerId;
        saveRole = "USER";
      }

      if (saveAsUserId !== callerId && saveAsMentorId !== callerId && role !== "ADMIN") {
        return res.status(403).json({ error: "Cannot modify another user's availability" });
      }

      const dateObj = typeof date === "string" ? parseDateUTC(date) : new Date(date);
      const dateStr = dateObj.toISOString().slice(0, 10);
      if (isPastDateOnly(dateStr)) {
        return res.status(400).json({ error: "Cannot set availability in the past" });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);
      const { start: normStart, end: normEnd } = normalizeSlot(start, end);
      if (isPastTime(normStart)) {
        return res.status(400).json({ error: "Cannot set availability for past time" });
      }

      if (enabled) {
        toCreate.push({
          userId: saveAsUserId,
          mentorId: saveAsMentorId,
          role: saveRole,
          date: dateObj,
          startTime: normStart,
          endTime: normEnd,
        });
      } else {
        toDelete.push({
          userId: saveAsUserId,
          mentorId: saveAsMentorId,
          role: saveRole,
          date: dateObj,
          startTime: normStart,
        });
      }
    }

    for (const d of toDelete) {
      await prisma.availability.deleteMany({
        where: {
          ...(d.userId != null ? { userId: d.userId } : { mentorId: d.mentorId }),
          date: d.date,
          startTime: d.startTime,
        },
      });
    }

    for (const c of toCreate) {
      if (c.role === "MENTOR") {
        await prisma.availability.upsert({
          where: {
            mentorId_date_startTime: {
              mentorId: c.mentorId,
              date: c.date,
              startTime: c.startTime,
            },
          },
          create: {
            id: uuidv4(),
            userId: null,
            mentorId: c.mentorId,
            role: "MENTOR",
            date: c.date,
            startTime: c.startTime,
            endTime: c.endTime,
          },
          update: { endTime: c.endTime },
        });
      } else {
        await prisma.availability.upsert({
          where: {
            userId_date_startTime: {
              userId: c.userId,
              date: c.date,
              startTime: c.startTime,
            },
          },
          create: {
            id: uuidv4(),
            userId: c.userId,
            mentorId: null,
            role: "USER",
            date: c.date,
            startTime: c.startTime,
            endTime: c.endTime,
          },
          update: { endTime: c.endTime },
        });
      }
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";
import { isPastTime } from "../utils/time.js";

// List all users
export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: { id: true, name: true, email: true, timezone: true, tags: true, description: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
}

// List all mentors
export async function listMentors(req, res, next) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      select: { id: true, name: true, email: true, timezone: true, tags: true, description: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(mentors);
  } catch (e) {
    next(e);
  }
}

// Admin creates a user or mentor
export async function createUser(req, res, next) {
  try {
    const { name, email, password, role, tags, description } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!role || !["USER", "MENTOR"].includes(role)) {
      return res.status(400).json({ error: "Role must be USER or MENTOR" });
    }
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: name?.trim() || email.trim().split("@")[0],
        email: email.trim().toLowerCase(),
        password: hashed,
        role,
        timezone: "UTC",
        tags: tags || [],
        description: description || "",
      },
      select: { id: true, name: true, email: true, role: true, timezone: true, tags: true, description: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
}

// Update mentor metadata (tags + description) — Admin only
export async function updateMentorMetadata(req, res, next) {
  try {
    const { mentorId } = req.params;
    const { tags, description } = req.body;

    const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
    if (!mentor || mentor.role !== "MENTOR") {
      return res.status(404).json({ error: "Mentor not found" });
    }

    const data = {};
    if (tags !== undefined) data.tags = tags;
    if (description !== undefined) data.description = description;

    const updated = await prisma.user.update({
      where: { id: mentorId },
      data,
      select: { id: true, name: true, email: true, role: true, tags: true, description: true, createdAt: true },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
}

// Get a single user's details
export async function getUserDetails(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, tags: true, description: true, timezone: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    next(e);
  }
}

// Get availability for any user/mentor (admin view)
export async function getAvailabilityForUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { weekStart } = req.query;

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    const weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
    weekStartDate.setUTCHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setUTCDate(weekStartDate.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const where = {
      date: { gte: weekStartDate, lt: new Date(weekStartDate.getTime() + 7 * 86400000) },
    };

    if (targetUser.role === "MENTOR") {
      where.mentorId = userId;
      where.role = "MENTOR";
    } else {
      where.userId = userId;
      where.role = "USER";
    }

    const slots = await prisma.availability.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const byDate = {};
    dates.forEach((d) => (byDate[d] = []));
    slots.forEach((s) => {
      const d = s.date.toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({
        id: s.id,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      });
    });

    res.json({ weekStart: weekStartDate.toISOString().slice(0, 10), dates, availability: byDate });
  } catch (e) {
    next(e);
  }
}

// Get overlapping availability between a user and a mentor
export async function getOverlapSlots(req, res, next) {
  try {
    const { userId, mentorId } = req.params;
    const { weekStart } = req.query;

    const weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
    weekStartDate.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStartDate.getTime() + 7 * 86400000);

    const [userSlots, mentorSlots] = await Promise.all([
      prisma.availability.findMany({
        where: { userId, role: "USER", date: { gte: weekStartDate, lt: weekEnd } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      prisma.availability.findMany({
        where: { mentorId, role: "MENTOR", date: { gte: weekStartDate, lt: weekEnd } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
    ]);

    // Find overlapping time slots
    const overlaps = [];
    for (const us of userSlots) {
      for (const ms of mentorSlots) {
        const overlapStart = new Date(Math.max(us.startTime.getTime(), ms.startTime.getTime()));
        const overlapEnd = new Date(Math.min(us.endTime.getTime(), ms.endTime.getTime()));
        if (overlapStart < overlapEnd) {
          overlaps.push({
            date: us.date.toISOString().slice(0, 10),
            startTime: overlapStart.toISOString(),
            endTime: overlapEnd.toISOString(),
          });
        }
      }
    }

    res.json({ overlaps, userSlotsCount: userSlots.length, mentorSlotsCount: mentorSlots.length });
  } catch (e) {
    next(e);
  }
}

// Schedule a meeting — Admin only
export async function scheduleMeeting(req, res, next) {
  try {
    const adminId = req.userId;
    const { title, callType, userId, mentorId, startTime, endTime, notes } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (!callType) return res.status(400).json({ error: "Call type is required" });
    if (!userId) return res.status(400).json({ error: "User ID is required" });
    if (!mentorId) return res.status(400).json({ error: "Mentor ID is required" });
    if (!startTime || !endTime) return res.status(400).json({ error: "Start and end time are required" });

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) return res.status(400).json({ error: "End time must be after start time" });
    if (isPastTime(start)) return res.status(400).json({ error: "Cannot schedule meeting in the past" });

    const meeting = await prisma.meeting.create({
      data: {
        id: uuidv4(),
        adminId,
        userId,
        mentorId,
        title: title.trim(),
        callType,
        startTime: start,
        endTime: end,
        notes: notes || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(meeting);
  } catch (e) {
    next(e);
  }
}

// List all meetings
export async function listMeetings(req, res, next) {
  try {
    const meetings = await prisma.meeting.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: "desc" },
    });
    res.json(meetings);
  } catch (e) {
    next(e);
  }
}

// Delete a meeting
export async function deleteMeeting(req, res, next) {
  try {
    await prisma.meeting.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Meeting deleted" });
  } catch (e) {
    next(e);
  }
}

// Get meetings for a specific user or mentor
export async function getMyMeetings(req, res, next) {
  try {
    const id = req.userId;
    const role = req.userRole;

    const where = role === "MENTOR" ? { mentorId: id } : { userId: id };

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: "desc" },
    });
    res.json(meetings);
  } catch (e) {
    next(e);
  }
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

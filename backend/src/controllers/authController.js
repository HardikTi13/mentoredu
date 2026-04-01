import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

function createToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true, name: true, email: true, password: true,
        role: true, timezone: true, tags: true, description: true, createdAt: true,
      },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = createToken(user);
    const { password: _p, ...safe } = user;
    res.json({ user: safe, token });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, name: true, email: true, role: true,
        timezone: true, tags: true, description: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { tags, description } = req.body;
    const data = {};
    if (tags !== undefined) data.tags = tags;
    if (description !== undefined) data.description = description;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true, name: true, email: true, role: true,
        timezone: true, tags: true, description: true, createdAt: true,
      },
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
}

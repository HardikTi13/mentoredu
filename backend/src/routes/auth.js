import { Router } from "express";
import { login, me, updateProfile } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

export const authRoutes = Router();

authRoutes.post("/login", login);
authRoutes.get("/me", authenticate, me);
authRoutes.put("/profile", authenticate, updateProfile);

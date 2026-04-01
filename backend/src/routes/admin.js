import { Router } from "express";
import {
  listUsers, listMentors, createUser, updateMentorMetadata,
  getUserDetails, getAvailabilityForUser, getOverlapSlots,
  scheduleMeeting, listMeetings, deleteMeeting,
} from "../controllers/adminController.js";
import { getRecommendations } from "../controllers/recommendationController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRole("ADMIN"));

adminRoutes.get("/users", listUsers);
adminRoutes.get("/mentors", listMentors);
adminRoutes.get("/user/:userId", getUserDetails);
adminRoutes.post("/create-user", createUser);
adminRoutes.put("/mentor/:mentorId", updateMentorMetadata);
adminRoutes.get("/availability/:userId", getAvailabilityForUser);
adminRoutes.get("/overlap/:userId/:mentorId", getOverlapSlots);
adminRoutes.get("/recommendations/:userId", getRecommendations);
adminRoutes.post("/meetings", scheduleMeeting);
adminRoutes.get("/meetings", listMeetings);
adminRoutes.delete("/meetings/:id", deleteMeeting);

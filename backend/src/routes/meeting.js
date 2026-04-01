import { Router } from "express";
import { getMyMeetings } from "../controllers/adminController.js";
import { authenticate } from "../middleware/auth.js";

export const meetingRoutes = Router();

meetingRoutes.use(authenticate);
meetingRoutes.get("/my", getMyMeetings);

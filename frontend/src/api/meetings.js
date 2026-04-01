import { get } from "./client.js";
import * as adminApi from "./admin.js";

// For users/mentors: get their own scheduled meetings
export const getMyMeetings = () => get("/api/meetings/my");

// Admin: list/delete meetings (delegate to admin API)
export const listMeetings  = () => adminApi.listMeetings();
export const deleteMeeting = (id) => adminApi.deleteMeeting(id);

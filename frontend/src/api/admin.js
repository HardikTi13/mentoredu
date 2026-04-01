import { get, post, put, del } from "./client.js";

export const listUsers             = ()                     => get("/api/admin/users");
export const listMentors           = ()                     => get("/api/admin/mentors");
export const getUserDetails        = (userId)               => get(`/api/admin/user/${userId}`);
export const createUser            = (data)                 => post("/api/admin/create-user", data);
export const updateMentorMetadata  = (mentorId, data)       => put(`/api/admin/mentor/${mentorId}`, data);
export const getAvailabilityForUser = (userId, weekStart)   => {
  const q = weekStart ? `?weekStart=${weekStart}` : "";
  return get(`/api/admin/availability/${userId}${q}`);
};
export const getOverlapSlots = (userId, mentorId, weekStart) => {
  const q = weekStart ? `?weekStart=${weekStart}` : "";
  return get(`/api/admin/overlap/${userId}/${mentorId}${q}`);
};
export const getRecommendations = (userId, callType) =>
  get(`/api/admin/recommendations/${userId}?callType=${callType}`);
export const scheduleMeeting = (data)  => post("/api/admin/meetings", data);
export const listMeetings    = ()      => get("/api/admin/meetings");
export const deleteMeeting   = (id)    => del(`/api/admin/meetings/${id}`);

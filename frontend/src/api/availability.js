import { get, post } from "./client.js";

export const getWeekly = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return get(`/api/availability/weekly${q ? `?${q}` : ""}`);
};
export const saveBatch = (slots) => post("/api/availability/batch", { slots });

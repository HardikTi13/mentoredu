import { api, get, post, put } from "./client.js";

export const login = (data) => post("/api/auth/login", data);
export const me = () => api("GET", `/api/auth/me?_=${Date.now()}`, null);
export const updateProfile = (data) => put("/api/auth/profile", data);

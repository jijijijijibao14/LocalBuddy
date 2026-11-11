import axios from "axios";
import { resolveMediaUrl } from "../utils/mediaUrl";

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const currentHost = window.location.hostname;
    if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      if (!configured || /^(http:\/\/)?(\d+\.\d+\.\d+\.\d+)(:\d+)?(\/api)?\/?$/.test(configured)) {
        return "http://localhost:3001/api";
      }
    } else if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(currentHost)) {
      return `http://${currentHost}:3001/api`;
    }
  }
  return configured || (import.meta.env.DEV ? "http://localhost:3001/api" : "");
}

const apiBaseUrl = resolveApiBaseUrl();
export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, "");
export const mediaUrl = (value) => resolveMediaUrl(value, API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL || undefined,
});
api.interceptors.request.use((config) => {
  if (!API_BASE_URL) {
    return Promise.reject(
      new Error(
        "VITE_API_URL chưa được cấu hình. Hãy đặt URL backend kết thúc bằng /api trên nền tảng frontend và deploy lại.",
      ),
    );
  }

  const token = localStorage.getItem("lb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export default api;

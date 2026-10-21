import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? "http://localhost:3001/api" : "");
export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, "");

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

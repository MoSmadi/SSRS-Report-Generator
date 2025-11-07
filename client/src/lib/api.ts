import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000",
  timeout: 15000,
});

api.interceptors.response.use(
  res => {
    console.debug("[API OK]", res.config?.url, res.status, res.data);
    return res;
  },
  err => {
    console.error(
      "[API ERROR]",
      err.config?.url,
      err.message,
      err.response?.status,
      err.response?.data
    );
    return Promise.reject(err);
  }
);

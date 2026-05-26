import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 35000,
});

export const healthCheck = () => api.get("/api/health");
export const predictCrop = (payload) => api.post("/api/predict/crop", payload);
export const predictYield = (payload) => api.post("/api/predict/yield", payload);
export const predictClimateRisk = (payload) =>
  api.post("/api/predict/climate-risk", payload);
export const getMetadata = () => api.get("/api/metadata/features");
export const getCurrentWeather = (lat, lon) =>
  api.get("/api/weather/current", { params: { lat, lon } });

export default api;

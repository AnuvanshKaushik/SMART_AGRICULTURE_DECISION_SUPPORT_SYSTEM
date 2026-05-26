import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Loader from "../components/Loader";
import {
  getCurrentWeather,
  getMetadata,
  predictClimateRisk,
  predictCrop,
  predictYield,
} from "../api/client";

const cropDefaults = {
  N: 90,
  P: 42,
  K: 43,
  temperature: 25,
  humidity: 70,
  ph: 6.5,
  rainfall: 120,
};

const fallbackYieldFeatures = [
  "Year",
  "State Code",
  "Dist Code",
  "Area_ha",
  "N_req_kg_per_ha",
  "P_req_kg_per_ha",
  "K_req_kg_per_ha",
  "Temperature_C",
  "Humidity_%",
  "pH",
  "Rainfall_mm",
  "Wind_Speed_m_s",
  "Solar_Radiation_MJ_m2_day",
];

const fallbackClimateFeatures = [
  "avg_temp_c",
  "total_rainfall_mm",
  "avg_humidity_percent",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_sum",
  "rain_sum",
  "weather_code",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
];

const moduleTabs = ["crop", "yield", "climate"];

async function fetchWeatherFromOpenMeteo(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    temperature_unit: "celsius",
    wind_speed_unit: "ms",
    precipitation_unit: "mm",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
    ].join(","),
    daily: [
      "precipitation_sum",
      "temperature_2m_max",
      "temperature_2m_min",
      "apparent_temperature_max",
      "apparent_temperature_min",
    ].join(","),
    timezone: "auto",
    forecast_days: "1",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with ${response.status}`);
  }

  const raw = await response.json();
  const current = raw.current || {};
  const daily = raw.daily || {};

  return {
    latitude: raw.latitude ?? latitude,
    longitude: raw.longitude ?? longitude,
    timezone: raw.timezone || "auto",
    time: current.time || daily.time?.[0] || new Date().toISOString(),
    source: "open-meteo",
    weather: {
      temperature_2m: current.temperature_2m ?? null,
      relative_humidity_2m: current.relative_humidity_2m ?? null,
      apparent_temperature: current.apparent_temperature ?? null,
      precipitation: current.precipitation ?? null,
      rain: current.rain ?? null,
      weather_code: current.weather_code ?? null,
      wind_speed_10m: current.wind_speed_10m ?? null,
      wind_gusts_10m: current.wind_gusts_10m ?? null,
      wind_direction_10m: current.wind_direction_10m ?? null,
      precipitation_sum: daily.precipitation_sum?.[0] ?? current.precipitation ?? null,
      temperature_2m_max: daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? null,
      temperature_2m_min: daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? null,
      apparent_temperature_max:
        daily.apparent_temperature_max?.[0] ?? current.apparent_temperature ?? null,
      apparent_temperature_min:
        daily.apparent_temperature_min?.[0] ?? current.apparent_temperature ?? null,
    },
  };
}

function buildDefaults(keys, baseline = 1) {
  return keys.reduce((acc, key) => {
    acc[key] = baseline;
    return acc;
  }, {});
}

const yieldDefaultValues = {
  Year: 2024,
  "State Code": 10,
  "Dist Code": 250,
  Area_ha: 16900,
  N_req_kg_per_ha: 20.29,
  P_req_kg_per_ha: 10.03,
  K_req_kg_per_ha: 17,
  Temperature_C: 22,
  "Humidity_%": 70,
  pH: 6.5,
  Rainfall_mm: 800,
  Wind_Speed_m_s: 2,
  Solar_Radiation_MJ_m2_day: 18,
};

function buildYieldDefaults(keys) {
  return keys.reduce((acc, key) => {
    acc[key] = yieldDefaultValues[key] ?? 0;
    return acc;
  }, {});
}

export default function DashboardPage() {
  const [tab, setTab] = useState("crop");
  const [yieldFeatures, setYieldFeatures] = useState(fallbackYieldFeatures);
  const [climateFeatures, setClimateFeatures] = useState(fallbackClimateFeatures);

  const [cropForm, setCropForm] = useState(cropDefaults);
  const [yieldForm, setYieldForm] = useState(buildYieldDefaults(fallbackYieldFeatures));
  const [climateForm, setClimateForm] = useState(
    buildDefaults(fallbackClimateFeatures, 20)
  );

  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [weatherNotice, setWeatherNotice] = useState("");
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [lat, setLat] = useState(28.6139);
  const [lon, setLon] = useState(77.209);
  const [cropResult, setCropResult] = useState(null);
  const [yieldResult, setYieldResult] = useState(null);
  const [climateResult, setClimateResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMetadata();
        const y = res.data.yield_features || fallbackYieldFeatures;
        const c = res.data.climate_features || fallbackClimateFeatures;
        setYieldFeatures(y);
        setClimateFeatures(c);
        setYieldForm(buildYieldDefaults(y));
        setClimateForm(buildDefaults(c, 20));
      } catch {
        setYieldFeatures(fallbackYieldFeatures);
        setClimateFeatures(fallbackClimateFeatures);
        setYieldForm(buildYieldDefaults(fallbackYieldFeatures));
      }
    })();
  }, []);

  const riskBar = useMemo(() => {
    const score = climateResult?.risk_score || 0;
    const width = `${Math.round(score * 100)}%`;
    const color =
      climateResult?.risk_level === "High"
        ? "#e53935"
        : climateResult?.risk_level === "Medium"
        ? "#fb8c00"
        : "#43a047";
    return { width, color };
  }, [climateResult]);

  const yieldChartData = useMemo(() => {
    const val = yieldResult?.predicted_yield || 0;
    if (!val) return [];
    return [
      { label: "Conservative", yield: +(val * 0.92).toFixed(2) },
      { label: "Predicted", yield: +val.toFixed(2) },
      { label: "Optimistic", yield: +(val * 1.08).toFixed(2) },
    ];
  }, [yieldResult]);

  const updateForm = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const runCropPrediction = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await predictCrop(cropForm);
      setCropResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Crop prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const runYieldPrediction = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await predictYield({ features: yieldForm });
      setYieldResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Yield prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const runClimatePrediction = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await predictClimateRisk({ features: climateForm });
      setClimateResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Climate risk prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const applyWeatherToForms = (w) => {
    setCropForm((prev) => ({
      ...prev,
      temperature: w.temperature_2m ?? prev.temperature,
      humidity: w.relative_humidity_2m ?? prev.humidity,
      rainfall: w.precipitation_sum ?? prev.rainfall,
    }));

    setClimateForm((prev) => ({
      ...prev,
      avg_temp_c: w.temperature_2m ?? prev.avg_temp_c,
      total_rainfall_mm: w.precipitation_sum ?? prev.total_rainfall_mm,
      avg_humidity_percent: w.relative_humidity_2m ?? prev.avg_humidity_percent,
      temperature_2m_max: w.temperature_2m_max ?? prev.temperature_2m_max,
      temperature_2m_min: w.temperature_2m_min ?? prev.temperature_2m_min,
      apparent_temperature_max:
        w.apparent_temperature_max ?? prev.apparent_temperature_max,
      apparent_temperature_min:
        w.apparent_temperature_min ?? prev.apparent_temperature_min,
      precipitation_sum: w.precipitation_sum ?? prev.precipitation_sum,
      rain_sum: w.rain ?? prev.rain_sum,
      weather_code: w.weather_code ?? prev.weather_code,
      wind_speed_10m_max: w.wind_speed_10m ?? prev.wind_speed_10m_max,
      wind_gusts_10m_max: w.wind_gusts_10m ?? prev.wind_gusts_10m_max,
      wind_direction_10m_dominant:
        w.wind_direction_10m ?? prev.wind_direction_10m_dominant,
    }));

    setYieldForm((prev) => ({
      ...prev,
      Temperature_C: w.temperature_2m ?? prev.Temperature_C,
      "Humidity_%": w.relative_humidity_2m ?? prev["Humidity_%"],
      Rainfall_mm: w.precipitation_sum ?? prev.Rainfall_mm,
      Wind_Speed_m_s: w.wind_speed_10m ?? prev.Wind_Speed_m_s,
    }));
  };

  const fetchAndApplyWeather = async (latitude, longitude) => {
    setWeatherError("");
    setWeatherNotice("");
    setWeatherLoading(true);
    try {
      let payload;
      let backendFailure = "";

      try {
        const res = await getCurrentWeather(latitude, longitude);
        payload = res.data;
      } catch (err) {
        backendFailure =
          err?.response?.data?.detail ||
          err?.message ||
          "Weather service is unavailable.";
        payload = await fetchWeatherFromOpenMeteo(latitude, longitude);
      }

      setWeatherInfo(payload);
      applyWeatherToForms(payload.weather);
      if (backendFailure) {
        setWeatherNotice(`Backend weather service was unavailable, so direct forecast data was used. ${backendFailure}`);
      }
    } catch (err) {
      setWeatherError(
        err?.response?.data?.detail ||
          err?.message ||
          "Could not fetch live weather."
      );
    } finally {
      setWeatherLoading(false);
    }
  };

  const useDeviceLocation = () => {
    setWeatherError("");
    setWeatherNotice("");
    if (!navigator.geolocation) {
      setWeatherError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = Number(pos.coords.latitude.toFixed(6));
        const longitude = Number(pos.coords.longitude.toFixed(6));
        setLat(latitude);
        setLon(longitude);
        fetchAndApplyWeather(latitude, longitude);
      },
      () => {
        setWeatherError("Location permission denied. Enter latitude/longitude manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="page-stack">
      <section className="glass-panel">
        <h1>Prediction Dashboard</h1>
        <p>Choose a module, enter farm parameters, and run AI inference.</p>

        <div className="weather-tools">
          <h3>Live Weather Autofill</h3>
          <p>Use current weather to auto-fill climate fields for faster predictions.</p>
          <div className="weather-actions">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                value={lon}
                onChange={(e) => setLon(Number(e.target.value))}
              />
            </label>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={useDeviceLocation}
              disabled={weatherLoading}
            >
              Use My Location
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => fetchAndApplyWeather(lat, lon)}
              disabled={weatherLoading}
            >
              {weatherLoading ? "Fetching..." : "Fetch Live Weather"}
            </button>
          </div>
          {weatherInfo && (
            <p className="muted">
              Updated from {weatherInfo.time} ({weatherInfo.timezone}) at{" "}
              {weatherInfo.latitude}, {weatherInfo.longitude}
            </p>
          )}
          {weatherNotice && <div className="info-box">{weatherNotice}</div>}
          {weatherError && <div className="error-box">{weatherError}</div>}
        </div>

        <div className="tab-row">
          {moduleTabs.map((item) => (
            <button
              key={item}
              className={item === tab ? "tab-btn active" : "tab-btn"}
              onClick={() => setTab(item)}
            >
              {item === "crop"
                ? "Crop Recommendation"
                : item === "yield"
                ? "Yield Prediction"
                : "Climate Risk"}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {loading && <Loader />}

      {tab === "crop" && (
        <motion.section className="glass-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Crop Recommendation</h2>
          <form className="input-grid" onSubmit={runCropPrediction}>
            {Object.keys(cropDefaults).map((field) => (
              <label key={field}>
                {field}
                <input
                  type="number"
                  step="any"
                  name={field}
                  value={cropForm[field]}
                  onChange={updateForm(setCropForm)}
                  required
                />
              </label>
            ))}
            <button className="btn btn-primary" type="submit">
              Predict Best Crop
            </button>
          </form>

          {cropResult && (
            <div className="result-card crop-result">
              <h3>Recommended Crop: {cropResult.crop}</h3>
              <p>Confidence: {(cropResult.confidence * 100).toFixed(2)}%</p>
              <div className="chip-row">
                {Object.entries(cropResult.top_predictions).map(([name, value]) => (
                  <span key={name} className="chip">
                    {name}: {(value * 100).toFixed(1)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.section>
      )}

      {tab === "yield" && (
        <motion.section className="glass-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Yield Prediction</h2>
          <form className="input-grid compact" onSubmit={runYieldPrediction}>
            {yieldFeatures.map((field) => (
              <label key={field}>
                {field}
                <input
                  type="number"
                  step="any"
                  name={field}
                  value={yieldForm[field] ?? 0}
                  onChange={updateForm(setYieldForm)}
                  required
                />
              </label>
            ))}
            <button className="btn btn-primary" type="submit">
              Predict Yield
            </button>
          </form>

          {yieldResult && (
            <div className="result-card">
              <h3>Predicted Yield: {yieldResult.predicted_yield.toFixed(2)} kg/ha</h3>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={yieldChartData}>
                    <defs>
                      <linearGradient id="yieldFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#66bb6a" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="yield"
                      stroke="#2e7d32"
                      fill="url(#yieldFill)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </motion.section>
      )}

      {tab === "climate" && (
        <motion.section className="glass-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Climate Risk Analysis</h2>
          <form className="input-grid compact" onSubmit={runClimatePrediction}>
            {climateFeatures.map((field) => (
              <label key={field}>
                {field}
                <input
                  type="number"
                  step="any"
                  name={field}
                  value={climateForm[field] ?? 0}
                  onChange={updateForm(setClimateForm)}
                  required
                />
              </label>
            ))}
            <button className="btn btn-primary" type="submit">
              Analyze Climate Risk
            </button>
          </form>

          {climateResult && (
            <div className="result-card">
              <h3>Risk Level: {climateResult.risk_level}</h3>
              <p>{climateResult.explanation}</p>
              <div className="risk-meter">
                <div className="risk-fill" style={riskBar} />
              </div>
              <p className="muted">Risk Score: {(climateResult.risk_score * 100).toFixed(1)}%</p>
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
}

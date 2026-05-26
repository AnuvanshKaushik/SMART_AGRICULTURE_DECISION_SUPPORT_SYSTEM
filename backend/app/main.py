import json
import logging

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import (
    ClimateRiskRequest,
    ClimateRiskResponse,
    CropRecommendationRequest,
    CropRecommendationResponse,
    HealthResponse,
    YieldPredictionRequest,
    YieldPredictionResponse,
)
from app.services.model_service import model_service
from app.utils.preprocess import (
    CLIMATE_FEATURES,
    YIELD_FEATURES,
    build_climate_sequence,
)

app = FastAPI(title=settings.app_title, version=settings.app_version)
logger = logging.getLogger("smart_agri.api")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


def _normalize_unit(unit: str | None) -> str:
    if not unit:
        return ""
    return unit.strip().lower().replace(" ", "")


def _as_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _convert_temperature_c(value: float | None, unit: str | None) -> float | None:
    if value is None:
        return None
    u = _normalize_unit(unit)
    if u in ("c", "°c", "celsius"):
        return value
    if u in ("f", "°f", "fahrenheit"):
        return (value - 32.0) * 5.0 / 9.0
    return value


def _convert_wind_ms(value: float | None, unit: str | None) -> float | None:
    if value is None:
        return None
    u = _normalize_unit(unit)
    if u in ("m/s", "ms"):
        return value
    if u in ("km/h", "kmh", "kph"):
        return value / 3.6
    if u in ("mph",):
        return value * 0.44704
    return value


def _convert_precip_mm(value: float | None, unit: str | None) -> float | None:
    if value is None:
        return None
    u = _normalize_unit(unit)
    if u in ("mm", "millimeter", "millimeters"):
        return value
    if u in ("cm", "centimeter", "centimeters"):
        return value * 10.0
    if u in ("in", "inch", "inches"):
        return value * 25.4
    return value


def _first_valid(values: list[object] | None) -> float | None:
    if not values:
        return None
    for item in values:
        num = _as_float(item)
        if num is not None:
            return num
    return None

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    flags = model_service.health()
    status = "ok" if all(flags.values()) else "degraded"
    return HealthResponse(status=status, **flags)


@app.get("/api/metadata/features")
def feature_metadata() -> dict:
    return {
        "yield_features": YIELD_FEATURES,
        "climate_features": CLIMATE_FEATURES,
        "yield_sequence_length": 1,
        "climate_sequence_length": 60,
        "yield_notes": "Yield prediction uses historical district/state data with agronomic and weather inputs.",
    }


@app.get("/api/weather/current")
def current_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> dict:
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "temperature_unit": "celsius",
            "wind_speed_unit": "ms",
            "precipitation_unit": "mm",
            "current": ",".join(
                [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "apparent_temperature",
                    "precipitation",
                    "rain",
                    "weather_code",
                    "wind_speed_10m",
                    "wind_gusts_10m",
                    "wind_direction_10m",
                ]
            ),
            "hourly": "precipitation",
            "daily": ",".join(
                [
                    "precipitation_sum",
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "apparent_temperature_max",
                    "apparent_temperature_min",
                ]
            ),
            "timezone": "auto",
            "forecast_days": 1,
        }

        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()
        logger.info("Raw weather API response: %s", json.dumps(raw))

        current = raw.get("current", {})
        current_units = raw.get("current_units", {})
        daily = raw.get("daily", {})
        daily_units = raw.get("daily_units", {})
        hourly = raw.get("hourly", {})
        hourly_units = raw.get("hourly_units", {})

        precip_daily = _first_valid(daily.get("precipitation_sum"))
        if precip_daily is None:
            # Fallback: sum hourly precipitation if daily aggregate is unavailable.
            hourly_precip = [
                p for p in (_as_float(x) for x in hourly.get("precipitation", [])) if p is not None
            ]
            precip_daily = sum(hourly_precip) if hourly_precip else None

        temperature_2m = _convert_temperature_c(
            _as_float(current.get("temperature_2m")), current_units.get("temperature_2m")
        )
        humidity_2m = _as_float(current.get("relative_humidity_2m"))
        apparent_temperature = _convert_temperature_c(
            _as_float(current.get("apparent_temperature")),
            current_units.get("apparent_temperature"),
        )
        precipitation = _convert_precip_mm(
            _as_float(current.get("precipitation")), current_units.get("precipitation")
        )
        rain = _convert_precip_mm(_as_float(current.get("rain")), current_units.get("rain"))
        weather_code = _as_float(current.get("weather_code"))
        wind_speed = _convert_wind_ms(
            _as_float(current.get("wind_speed_10m")), current_units.get("wind_speed_10m")
        )
        wind_gust = _convert_wind_ms(
            _as_float(current.get("wind_gusts_10m")), current_units.get("wind_gusts_10m")
        )
        wind_dir = _as_float(current.get("wind_direction_10m"))

        temperature_max = _convert_temperature_c(
            _first_valid(daily.get("temperature_2m_max")), daily_units.get("temperature_2m_max")
        )
        temperature_min = _convert_temperature_c(
            _first_valid(daily.get("temperature_2m_min")), daily_units.get("temperature_2m_min")
        )
        apparent_temperature_max = _convert_temperature_c(
            _first_valid(daily.get("apparent_temperature_max")),
            daily_units.get("apparent_temperature_max"),
        )
        apparent_temperature_min = _convert_temperature_c(
            _first_valid(daily.get("apparent_temperature_min")),
            daily_units.get("apparent_temperature_min"),
        )
        precipitation_sum = _convert_precip_mm(precip_daily, daily_units.get("precipitation_sum"))

        weather_payload = {
            "temperature_2m": temperature_2m,
            "relative_humidity_2m": humidity_2m,
            "apparent_temperature": apparent_temperature,
            "precipitation": precipitation,
            "rain": rain,
            "weather_code": weather_code,
            "wind_speed_10m": wind_speed,
            "wind_gusts_10m": wind_gust,
            "wind_direction_10m": wind_dir,
            "precipitation_sum": precipitation_sum,
            "temperature_2m_max": temperature_max,
            "temperature_2m_min": temperature_min,
            "apparent_temperature_max": apparent_temperature_max,
            "apparent_temperature_min": apparent_temperature_min,
        }
        missing_fields = [k for k, v in weather_payload.items() if v is None]

        return {
            "latitude": raw.get("latitude", lat),
            "longitude": raw.get("longitude", lon),
            "timezone": raw.get("timezone"),
            "time": current.get("time"),
            "weather": weather_payload,
            "missing_fields": missing_fields,
            "units": {
                "temperature": "C",
                "humidity": "%",
                "precipitation": "mm",
                "wind_speed": "m/s",
                "wind_direction": "degrees",
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Weather fetch failed: {exc}") from exc


@app.post("/api/predict/crop", response_model=CropRecommendationResponse)
def predict_crop(payload: CropRecommendationRequest) -> CropRecommendationResponse:
    try:
        crop, confidence, top_predictions = model_service.predict_crop(payload.model_dump())
        return CropRecommendationResponse(
            crop=crop,
            confidence=confidence,
            top_predictions=top_predictions,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/predict/yield", response_model=YieldPredictionResponse)
def predict_yield(payload: YieldPredictionRequest) -> YieldPredictionResponse:
    try:
        feature_source = payload.history[-1] if payload.history else payload.features
        prediction = model_service.predict_yield(feature_source)
        logger.info("Predicted yield (kg/ha): %s", prediction)
        return YieldPredictionResponse(predicted_yield=prediction)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/predict/climate-risk", response_model=ClimateRiskResponse)
def predict_climate(payload: ClimateRiskRequest) -> ClimateRiskResponse:
    try:
        sequence = build_climate_sequence(payload.features, payload.history)
        ordered_vector = {
            feature: float(sequence[0][idx]) for idx, feature in enumerate(CLIMATE_FEATURES)
        }
        logger.info("Processed climate feature vector (ordered): %s", ordered_vector)
        score = model_service.predict_climate_risk(sequence)

        if score < 0.34:
            level = "Low"
            explanation = "Current conditions suggest low short-term climate stress for crops."
        elif score < 0.67:
            level = "Medium"
            explanation = (
                "Moderate climate volatility detected. Consider irrigation planning and resilient crop choices."
            )
        else:
            level = "High"
            explanation = (
                "High climate risk detected. Use protective measures, crop insurance, and close weather monitoring."
            )

        return ClimateRiskResponse(risk_level=level, risk_score=score, explanation=explanation)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

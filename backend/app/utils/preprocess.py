from __future__ import annotations

import numpy as np


YIELD_FEATURES = [
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
]

CLIMATE_FEATURES = [
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
]


def _ordered_vector(features: dict[str, float], ordered_keys: list[str]) -> np.ndarray:
    missing = [k for k in ordered_keys if k not in features]
    if missing:
        raise ValueError(f"Missing required features: {missing}")
    values: list[float] = []
    invalid: list[str] = []
    for k in ordered_keys:
        v = features[k]
        if v is None:
            invalid.append(k)
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            invalid.append(k)
            continue
        if np.isnan(fv):
            invalid.append(k)
            continue
        values.append(fv)

    if invalid:
        raise ValueError(f"Invalid (null/non-numeric) feature values: {invalid}")

    return np.array(values, dtype=np.float32)


def build_yield_sequence(
    features: dict[str, float],
    history: list[dict[str, float]] | None,
    sequence_len: int = 5,
) -> np.ndarray:
    if history:
        if len(history) != sequence_len:
            raise ValueError(f"Yield history must contain exactly {sequence_len} rows")
        seq = [_ordered_vector(row, YIELD_FEATURES) for row in history]
    else:
        row = _ordered_vector(features, YIELD_FEATURES)
        seq = [row.copy() for _ in range(sequence_len)]

    return np.stack(seq, axis=0)


def build_climate_sequence(
    features: dict[str, float],
    history: list[dict[str, float]] | None,
    sequence_len: int = 60,
) -> np.ndarray:
    if history:
        if len(history) != sequence_len:
            raise ValueError(
                f"Climate history must contain exactly {sequence_len} rows"
            )
        seq = [_ordered_vector(row, CLIMATE_FEATURES) for row in history]
    else:
        row = _ordered_vector(features, CLIMATE_FEATURES)
        seq = [row.copy() for _ in range(sequence_len)]

    return np.stack(seq, axis=0)

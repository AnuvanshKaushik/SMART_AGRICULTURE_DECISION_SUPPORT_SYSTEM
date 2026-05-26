from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.config import settings
from app.utils.preprocess import CLIMATE_FEATURES, YIELD_FEATURES


@dataclass
class CropArtifacts:
    model: object
    label_encoder: object
    feature_columns: list[str]


@dataclass
class YieldArtifacts:
    model: Pipeline
    feature_columns: list[str]
    target_column: str
    validation_r2: float


class ModelService:
    def __init__(self) -> None:
        self._crop_artifacts: CropArtifacts | None = None
        self._yield_artifacts: YieldArtifacts | None = None
        self._climate_model: tf.keras.Model | None = None

    def _resolve_climate_model_path(self) -> Path:
        for candidate in settings.climate_model_candidates:
            path = settings.climate_dir / candidate
            if path.exists():
                return path
        raise FileNotFoundError(
            f"No climate model found in {settings.climate_dir} with names {settings.climate_model_candidates}"
        )

    @property
    def crop_artifacts(self) -> CropArtifacts:
        if self._crop_artifacts is None:
            self._crop_artifacts = CropArtifacts(
                model=joblib.load(settings.crop_model_path),
                label_encoder=joblib.load(settings.crop_label_encoder_path),
                feature_columns=list(joblib.load(settings.crop_feature_columns_path)),
            )
        return self._crop_artifacts

    @property
    def yield_artifacts(self) -> YieldArtifacts:
        if self._yield_artifacts is None:
            model, validation_r2 = self._train_yield_model()
            self._yield_artifacts = YieldArtifacts(
                model=model,
                feature_columns=list(YIELD_FEATURES),
                target_column="Yield_kg_per_ha",
                validation_r2=validation_r2,
            )
        return self._yield_artifacts

    @property
    def climate_model(self) -> tf.keras.Model:
        if self._climate_model is None:
            self._climate_model = tf.keras.models.load_model(
                self._resolve_climate_model_path(), compile=False
            )
        return self._climate_model

    def _train_yield_model(self) -> tuple[Pipeline, float]:
        df = pd.read_csv(settings.yield_training_data_path)
        target = "Yield_kg_per_ha"
        required_columns = list(YIELD_FEATURES) + [target]
        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Yield training data is missing columns: {missing}")

        dataset = df[required_columns].dropna().copy()
        X = dataset[YIELD_FEATURES].astype(np.float32)
        y = np.log1p(dataset[target].astype(np.float32))

        X_train, X_valid, y_train, y_valid = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        model = Pipeline(
            [
                ("scale", StandardScaler()),
                ("knn", KNeighborsRegressor(n_neighbors=15, weights="distance")),
            ]
        )
        model.fit(X_train, y_train)
        preds = model.predict(X_valid)
        score = float(r2_score(y_valid, preds))
        return model, score

    def health(self) -> dict[str, bool]:
        status = {
            "crop_model_loaded": False,
            "yield_model_loaded": False,
            "climate_model_loaded": False,
        }

        try:
            _ = self.crop_artifacts
            status["crop_model_loaded"] = True
        except Exception:
            pass

        try:
            _ = self.yield_artifacts
            status["yield_model_loaded"] = True
        except Exception:
            pass

        try:
            _ = self.climate_model
            status["climate_model_loaded"] = True
        except Exception:
            pass

        return status

    def predict_crop(self, payload: dict[str, float]) -> tuple[str, float, dict[str, float]]:
        art = self.crop_artifacts
        normalized = {
            str(k).strip().lower().replace("_", ""): float(v) for k, v in payload.items()
        }
        ordered_row: list[float] = []
        missing: list[str] = []
        for col in art.feature_columns:
            key = str(col).strip().lower().replace("_", "")
            if col in payload:
                ordered_row.append(float(payload[col]))
            elif key in normalized:
                ordered_row.append(normalized[key])
            else:
                missing.append(str(col))

        if missing:
            raise ValueError(f"Missing required crop features: {missing}")

        ordered = np.array([ordered_row], dtype=np.float32)
        prediction = art.model.predict(ordered)

        if hasattr(prediction, "tolist"):
            prediction = prediction.tolist()
        pred_value = prediction[0]

        if isinstance(pred_value, str):
            crop = pred_value
        else:
            crop = art.label_encoder.inverse_transform([int(pred_value)])[0]

        top_predictions: dict[str, float] = {}
        confidence = 0.0
        if hasattr(art.model, "predict_proba"):
            probs = art.model.predict_proba(ordered)[0]
            class_labels = [
                art.label_encoder.inverse_transform([int(cls)])[0]
                if not isinstance(cls, str)
                else cls
                for cls in getattr(art.model, "classes_", range(len(probs)))
            ]
            confidence = float(np.max(probs))
            top_idx = np.argsort(probs)[::-1][:3]
            top_predictions = {class_labels[i]: float(probs[i]) for i in top_idx}
        else:
            top_predictions = {crop: 1.0}
            confidence = 1.0

        return crop, confidence, top_predictions

    def _normalize_feature_payload(
        self, payload: dict[str, float], expected_columns: list[str]
    ) -> dict[str, float]:
        normalized = {
            str(k).strip().lower().replace("_", ""): float(v) for k, v in payload.items()
        }
        ordered: dict[str, float] = {}
        missing: list[str] = []
        for col in expected_columns:
            key = str(col).strip().lower().replace("_", "")
            if col in payload:
                ordered[col] = float(payload[col])
            elif key in normalized:
                ordered[col] = normalized[key]
            else:
                missing.append(col)

        if missing:
            raise ValueError(f"Missing required yield features: {missing}")

        return ordered

    def predict_yield(self, payload: dict[str, float]) -> float:
        art = self.yield_artifacts
        ordered = self._normalize_feature_payload(payload, art.feature_columns)
        X = pd.DataFrame([ordered], columns=art.feature_columns).astype(np.float32)
        raw_pred = float(art.model.predict(X)[0])
        return max(0.0, float(np.expm1(raw_pred)))

    def predict_climate_risk(self, sequence: np.ndarray) -> float:
        pred = self.climate_model.predict(
            sequence.reshape(1, 60, len(CLIMATE_FEATURES)), verbose=0
        )
        score = float(pred.reshape(-1)[0])
        return min(max(score, 0.0), 1.0)


model_service = ModelService()

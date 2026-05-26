import os
from pathlib import Path

from pydantic import BaseModel, Field


def _cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


class Settings(BaseModel):
    project_root: Path = Path(__file__).resolve().parents[2]
    models_dir: Path = project_root / "Models"
    data_dir: Path = project_root / "DATA"
    crop_model_path: Path = models_dir / "Crop_Rec" / "crop_recommendation_xgb.pkl"
    crop_label_encoder_path: Path = models_dir / "Crop_Rec" / "label_encoder.pkl"
    crop_feature_columns_path: Path = models_dir / "Crop_Rec" / "feature_columns.pkl"

    yield_model_path: Path = models_dir / "Yield" / "yield_lstm_model.h5"
    yield_scaler_path: Path = models_dir / "Yield" / "yield_scaler.pkl"
    yield_training_data_path: Path = data_dir / "Custom_Crops_yield_Historical_Dataset.csv"

    climate_dir: Path = models_dir / "Climate_Risk"
    climate_model_candidates: tuple[str, ...] = (
        "final_transformer_model.keras",
        "best_transformer.keras",
    )

    app_title: str = "AI Smart Agriculture System API"
    app_version: str = "1.0.0"

    cors_origins: list[str] = Field(default_factory=_cors_origins)


settings = Settings()

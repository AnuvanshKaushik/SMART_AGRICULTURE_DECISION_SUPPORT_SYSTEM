from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class CropRecommendationRequest(BaseModel):
    N: float = Field(..., description="Nitrogen content")
    P: float = Field(..., description="Phosphorous content")
    K: float = Field(..., description="Potassium content")
    temperature: float
    humidity: float
    ph: float
    rainfall: float


class CropRecommendationResponse(BaseModel):
    crop: str
    confidence: float
    top_predictions: Dict[str, float]


class YieldPredictionRequest(BaseModel):
    features: Dict[str, float] = Field(
        ..., description="Single feature snapshot for 23 yield inputs"
    )
    history: Optional[List[Dict[str, float]]] = Field(
        default=None,
        description="Optional list of 5 historical snapshots using same 23 inputs",
    )


class YieldPredictionResponse(BaseModel):
    predicted_yield: float
    unit: str = "kg/ha"


class ClimateRiskRequest(BaseModel):
    features: Dict[str, float] = Field(
        ..., description="Single feature snapshot for 13 climate inputs"
    )
    history: Optional[List[Dict[str, float]]] = Field(
        default=None,
        description="Optional list of 60 historical snapshots using same 13 inputs",
    )


class ClimateRiskResponse(BaseModel):
    risk_level: str
    risk_score: float
    explanation: str


class HealthResponse(BaseModel):
    status: str
    crop_model_loaded: bool
    yield_model_loaded: bool
    climate_model_loaded: bool

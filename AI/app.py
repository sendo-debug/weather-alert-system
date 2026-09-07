"""
Bareilly Nowcasting API
Run with: uvicorn app:app --host 0.0.0.0 --port 8000
Then test at http://localhost:8000/docs
"""

from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI(title="Bareilly Hyper-Local Nowcasting API")

# Load the trained model once at startup
model = joblib.load("bareilly_nowcast_model.pkl")

# Must match the FEATURES order from the training script exactly
FEATURE_ORDER = [
    "temperature_2m", "relative_humidity_2m", "surface_pressure",
    "wind_speed_10m", "wind_gusts_10m",
    "pressure_change_3h", "humidity_change_3h",
    "precip_last_3h", "wind_change_3h",
]


class WeatherReading(BaseModel):
    point_name: str
    temperature_2m: float
    relative_humidity_2m: float
    surface_pressure: float
    wind_speed_10m: float
    wind_gusts_10m: float
    pressure_change_3h: float
    humidity_change_3h: float
    precip_last_3h: float
    wind_change_3h: float


@app.get("/")
def root():
    return {"status": "ok", "message": "Bareilly nowcasting API is running"}


@app.post("/predict")
def predict(reading: WeatherReading):
    features = np.array([[getattr(reading, f) for f in FEATURE_ORDER]])
    prob = model.predict_proba(features)[0][1]  # probability of "severe"
    label = "severe" if prob >= 0.5 else "normal"

    return {
        "point_name": reading.point_name,
        "risk_score": round(float(prob), 3),
        "label": label,
    }


@app.post("/predict_batch")
def predict_batch(readings: list[WeatherReading]):
    results = []
    for r in readings:
        features = np.array([[getattr(r, f) for f in FEATURE_ORDER]])
        prob = model.predict_proba(features)[0][1]
        results.append({
            "point_name": r.point_name,
            "risk_score": round(float(prob), 3),
            "label": "severe" if prob >= 0.5 else "normal",
        })
    return results

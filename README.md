# AI Smart Agriculture Web System

Production-style web platform using your pre-trained models for:
- Crop Recommendation
- Crop Yield Prediction
- Climate Risk Analysis

No model retraining is required. The backend loads your existing artifacts from `Models/`.

## Project Structure

```text
Major_P/
+-- DATA/
+-- Models/
+-- backend/
¦   +-- app/
¦   ¦   +-- main.py
¦   ¦   +-- config.py
¦   ¦   +-- schemas.py
¦   ¦   +-- services/model_service.py
¦   ¦   +-- utils/preprocess.py
¦   +-- requirements.txt
+-- frontend/
¦   +-- src/
¦   ¦   +-- api/client.js
¦   ¦   +-- components/
¦   ¦   +-- pages/
¦   ¦   +-- App.jsx
¦   ¦   +-- main.jsx
¦   ¦   +-- styles.css
¦   +-- package.json
¦   +-- .env.example
+-- README.md
```

## Backend Setup (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: `http://127.0.0.1:8000/docs`

### Key Endpoints
- `GET /api/health`
- `GET /api/metadata/features`
- `POST /api/predict/crop`
- `POST /api/predict/yield`
- `POST /api/predict/climate-risk`

## Frontend Setup (React + Vite)

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open: `http://127.0.0.1:5173`

## Input Expectations

- Crop Recommendation expects: `N, P, K, temperature, humidity, ph, rainfall`
- Yield model expects 23 inputs and internally builds a 5-step sequence if history is not provided.
- Climate risk model expects 13 inputs and internally builds a 60-step sequence if history is not provided.

## Notes

- Existing trained models are loaded directly from:
  - `Models/Crop_Rec/`
  - `Models/Yield/`
  - `Models/Climate_Risk/`
- If you have GPU-enabled TensorFlow installed, inference can be faster.
- For production deployment, add process manager (e.g., Gunicorn + Uvicorn workers) and HTTPS reverse proxy.

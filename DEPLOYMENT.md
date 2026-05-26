# Deployment Guide

Recommended split:
- Backend: Render Web Service
- Frontend: Vercel Vite app

## 1. Deploy the Backend on Render

Create a new Web Service from the GitHub repository.

Use these settings:

```text
Root Directory: leave blank
Build Command: pip install -r backend/requirements.txt
Start Command: cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

After the frontend is deployed, add this environment variable in Render:

```text
CORS_ORIGINS=https://your-vercel-app.vercel.app
```

Your API health check will be available at:

```text
https://your-render-service.onrender.com/api/health
```

## 2. Deploy the Frontend on Vercel

Import the same GitHub repository into Vercel.

Use these settings:

```text
Root Directory: frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Add this environment variable in Vercel:

```text
VITE_API_URL=https://your-render-service.onrender.com
```

Redeploy the frontend after setting `VITE_API_URL`.

## 3. Final Wiring

After Vercel gives you the final frontend URL, update the Render backend
`CORS_ORIGINS` value with that URL and redeploy the backend.

If TensorFlow makes the backend build or startup too heavy for a small Render
instance, choose a larger instance or deploy the backend on a VM where you can
install the Python dependencies and run the same Uvicorn start command.

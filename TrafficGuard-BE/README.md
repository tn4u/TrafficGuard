# TrafficGuard — Backend

> **FastAPI** server that serves the camera list, runs real-time YOLO helmet detection on RTSP/HTTP streams, and processes manually uploaded images & videos.

---

## Project Structure

```
TrafficGuard-BE/
├── app/
│   ├── main.py                  ← FastAPI entry point
│   ├── core/
│   │   ├── config.py            ← Settings (reads .env)
│   │   ├── camera_api.py        ← HCMC camera URLs & coordinates
│   │   ├── mongo.py             ← MongoDB client
│   │   └── security.py         ← JWT helpers
│   ├── api/v1/endpoints/
│   │   ├── auth.py              ← /auth/*  (register, login)
│   │   ├── cameras.py           ← /cameras/*
│   │   ├── traffic.py           ← /traffic/detection/*
│   │   └── manual.py           ← /manual/image  /manual/video  ← NEW
│   ├── services/
│   │   ├── yolo_service.py      ← Loads model, runs inference
│   │   ├── camera_service.py    ← Fetches frames from HCMC cameras
│   │   └── traffic_service.py   ← Detection loop & stats
│   └── models/
│       ├── camera.py
│       └── user.py
├── ml/
│   └── models/
│       └── trained/             ← .pt file downloaded here on first boot
├── requirements.txt
├── .env.example                 ← Copy to .env and fill in
└── README.md
```

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.10+ |
| pip | 23+ |
| MongoDB | 6+ (local **or** Atlas free tier) |

> **GPU optional** — YOLO inference runs on CPU by default. A CUDA-capable GPU speeds up detection significantly.

---

## 1 · Clone & set up environment

```bash
cd TrafficGuard-BE

# Create virtual environment
python -m venv venv

# Activate
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

---

## 2 · Install dependencies

```bash
pip install -r requirements.txt
```

> `pymongo`, `ultralytics`, `opencv-python`, `fastapi`, and all other packages will be installed.

---

## 3 · Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set:

```env
# MongoDB (required)
MONGO_URI=mongodb://localhost:27017        # local
# or
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/trafficguard  # Atlas

# JWT secret (required — use a long random string)
JWT_SECRET_KEY=your_long_random_secret_here
```

> All other settings have sensible defaults and can be left as-is.

---

## 4 · Import the trained model

The server **automatically downloads** the trained YOLO model (`navflow_traffic_detection_v1.pt`) from GitHub Releases on first startup into:

```
ml/models/trained/navflow_traffic_detection_v1.pt
```

If you want to use a **custom model** from the ML repo instead:

```bash
# After training in TrafficGuard-ML, copy your best weights here:
cp ../TrafficGuard-ML/runs/detect/train/weights/best.pt ml/models/trained/navflow_traffic_detection_v1.pt
```

The path is controlled by `MODEL_DIR` in `app/core/config.py`.

---

## 5 · Import the camera API

Camera URLs and coordinates are already embedded in:

```
app/core/camera_api.py
```

It contains **15 live HCMC traffic cameras** with GPS coordinates for the Leaflet map. To add more cameras, append entries to both `CAMERA_URLS` and `CAMERA_CONFIGS` in that file.

---

## 6 · Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will:
1. Download the YOLO model (first run only)
2. Register all 15 HCMC cameras
3. Verify MongoDB connection

**API docs** are available at:
- Swagger UI: http://localhost:8000/api/v1/docs → `http://localhost:8000/docs`
- ReDoc: http://localhost:8000/redoc

---

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/cameras/` | List all cameras with coordinates |
| `POST` | `/api/v1/traffic/detection/start/{id}` | Start YOLO detection on a camera |
| `POST` | `/api/v1/traffic/detection/stop/{id}` | Stop detection |
| `GET` | `/api/v1/traffic/detection/stats/{id}` | Get latest detection stats |
| `GET` | `/api/v1/traffic/detection/stream/{id}` | Annotated JPEG frame |
| `POST` | `/api/v1/manual/image` | Upload image → annotated JPEG response |
| `POST` | `/api/v1/manual/image/json` | Upload image → JSON detections |
| `POST` | `/api/v1/manual/video` | Upload MP4 → violation timestamps JSON |
| `POST` | `/api/v1/auth/register` | Register user |
| `POST` | `/api/v1/auth/login` | Login (returns JWT) |

---

## Frontend connection

The **TrafficGuard frontend** (`TrafficGuard-FE`) points to `http://localhost:8000` by default.  
Check `src/config/api.config.js` in the frontend repo to adjust the base URL.

---

## Running all three services together

| Service | Command | Port |
|---------|---------|------|
| Frontend (Vite) | `npm run dev` (in `TrafficGuard-FE/`) | 5173 |
| Backend (FastAPI) | `uvicorn app.main:app --reload` (in `TrafficGuard-BE/`) | 8000 |
| MongoDB | `mongod` or use Atlas | 27017 |
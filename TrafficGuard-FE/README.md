# TrafficGuard — Frontend

> **React + Vite** single-page application for real-time helmet violation detection.  
> Connects to the TrafficGuard backend API at `http://localhost:8000`.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (Hero, Features, Team) |
| `/login` | Sign in with email + password, or continue as Guest |
| `/register` | Create an account |
| `/playground` | Live Leaflet map with HCMC traffic cameras |
| `/dashboard` | **Manual upload** — analyse a JPG/PNG/MP4 with YOLO |

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18 LTS+ |
| npm | 9+ |

```bash
node -v   # should print v18.x or higher
npm -v
```

---

## 1 · Install dependencies

```bash
cd TrafficGuard-FE
npm install
```

---

## 2 · Run the development server

```bash
npm run dev
```

Vite starts at **http://localhost:5173** (or the next available port).

---

## 3 · Connect to the backend

The API base URL is set in:

```
src/config/api.config.js
```

By default it points to `http://localhost:8000`.  
Make sure the backend is running before using the Playground or Manual pages.

---

## Running all three services together

| Service | Command | Port |
|---------|---------|------|
| **Frontend** | `npm run dev` (in `TrafficGuard-FE/`) | 5173 |
| **Backend** | `uvicorn app.main:app --reload` (in `TrafficGuard-BE/`) | 8000 |
| **MongoDB** | `mongod` or use Atlas | 27017 |
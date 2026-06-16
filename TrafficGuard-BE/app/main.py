from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.services.camera_service import camera_service
from app.core.camera_api import CAMERA_URLS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Welcome to TrafficGuard Backend API"}

@app.on_event("startup")
async def startup_event():
    try:
        # Initialize cameras from configuration
        for camera_id, url in CAMERA_URLS.items():
            camera_service.add_camera(camera_id, url)
        logger.info("Cameras initialized successfully")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
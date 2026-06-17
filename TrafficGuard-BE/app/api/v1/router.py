from fastapi import APIRouter
from .endpoints import cameras, traffic, auth, manual, youtube

api_router = APIRouter()

# Include all endpoint routers with clear prefixes
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(traffic.router, prefix="/traffic", tags=["traffic"])
api_router.include_router(cameras.router, prefix="/cameras", tags=["cameras"])
api_router.include_router(manual.router, prefix="/manual", tags=["manual"]) 
api_router.include_router(youtube.router, prefix="/youtube", tags=["youtube"])
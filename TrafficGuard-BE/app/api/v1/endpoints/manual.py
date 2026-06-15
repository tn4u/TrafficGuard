"""
Manual analysis endpoint — accepts image or video upload,
runs YOLO inference, returns annotated results.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import cv2
import numpy as np
import io
import tempfile
import os
from app.services.yolo_service import yolo_service

router = APIRouter()


@router.post("/image")
async def analyse_image(file: UploadFile = File(...)):
    """
    Upload a JPG/PNG image.
    Returns JSON with detections + a URL-encoded annotated image.
    """
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail="Only JPG/PNG images are accepted.")

    try:
        contents = await file.read()
        img_array = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode image.")

        # Run detection
        results, vis_frame = await yolo_service.detect_with_visualization(frame)

        # Encode annotated frame as JPEG
        _, buffer = cv2.imencode(".jpg", vis_frame)

        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/jpeg",
            headers={
                "X-Total-Vehicles": str(results["total_vehicles"]),
                "X-Fullness": str(round(results["fullness"], 2)),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image/json")
async def analyse_image_json(file: UploadFile = File(...)):
    """
    Upload a JPG/PNG image.
    Returns full JSON detection payload (no annotated image bytes).
    """
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail="Only JPG/PNG images are accepted.")

    try:
        contents = await file.read()
        img_array = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode image.")

        results = await yolo_service.detect(frame)
        return {
            "total_vehicles": results["total_vehicles"],
            "fullness": round(results["fullness"], 2),
            "detections": results["detections"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/video")
async def analyse_video(file: UploadFile = File(...)):
    """
    Upload an MP4 video.
    Samples every Nth frame, runs YOLO on each, returns violation list.
    The annotated video is not re-encoded server-side to keep latency low —
    violations reference original timestamps that the frontend can seek to.
    """
    if file.content_type not in ("video/mp4", "video/mpeg", "video/quicktime"):
        raise HTTPException(status_code=400, detail="Only MP4 videos are accepted.")

    try:
        # Write to a temp file so OpenCV can open it
        suffix = ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        sample_every = max(1, int(fps))  # 1 frame per second

        violations = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every == 0:
                timestamp = frame_idx / fps
                results = await yolo_service.detect(frame)

                # Collect no-helmet detections as violations
                for det in results["detections"]:
                    label_lower = det["label"].lower().replace(" ", "_")
                    if "no" in label_lower or "without" in label_lower or "nohelmet" in label_lower:
                        violations.append({
                            "timestamp": round(timestamp, 2),
                            "confidence": round(det["confidence"], 4),
                            "label": det["label"],
                            "bbox": det["bbox"],
                        })

            frame_idx += 1

        cap.release()
        os.unlink(tmp_path)

        return {
            "total_frames_sampled": frame_idx // sample_every,
            "violation_count": len(violations),
            "violations": violations,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
import asyncio
from functools import partial
from app.services.yolo_service import yolo_service

router = APIRouter()


@router.post("/image")
async def analyse_image(file: UploadFile = File(...)):
    """
    Upload a JPG/PNG image.
    Returns the annotated image (JPEG) with detection bounding boxes drawn.
    Response headers carry summary stats:
      X-Total-Detections  — number of objects detected
      X-Fullness          — road fullness percentage
    """
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail="Only JPG/PNG images are accepted.")

    try:
        contents = await file.read()
        img_array = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode image.")

        # Run detection + draw bounding boxes
        results, vis_frame = await yolo_service.detect_with_visualization(frame)

        # Encode annotated frame as JPEG
        _, buffer = cv2.imencode(".jpg", vis_frame)

        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/jpeg",
            headers={
                "X-Total-Detections": str(results["total_vehicles"]),
                "X-Fullness": str(round(results["fullness"], 2)),
                "Access-Control-Expose-Headers": "X-Total-Detections, X-Fullness",
            },
        )
    except HTTPException:
        raise
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
            "total_detections": results["total_vehicles"],
            "fullness": round(results["fullness"], 2),
            "detections": results["detections"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _process_video_sync(tmp_path: str):
    """
    CPU-bound video processing — runs in a thread executor so it does not
    block the async event loop.
    Returns a list of detection events (one per sampled frame).
    """
    cap = cv2.VideoCapture(tmp_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    sample_every = max(1, int(fps))  # 1 frame per second

    detections_log = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_every == 0:
            timestamp = round(frame_idx / fps, 2)

            # Run YOLO synchronously inside the thread
            import asyncio as _asyncio
            loop = _asyncio.new_event_loop()
            try:
                results = loop.run_until_complete(yolo_service.detect(frame))
            finally:
                loop.close()

            # Record every detection found at this timestamp
            for det in results["detections"]:
                detections_log.append({
                    "timestamp": timestamp,
                    "confidence": round(det["confidence"], 4),
                    "label": det["label"],
                    "bbox": det["bbox"],
                })

        frame_idx += 1

    cap.release()
    total_frames_sampled = max(1, frame_idx // sample_every)
    return detections_log, total_frames_sampled


@router.post("/video")
async def analyse_video(file: UploadFile = File(...)):
    """
    Upload an MP4 video.
    Samples 1 frame per second, runs YOLO on each.
    Returns a list of all detections (motorcycle / bicycle) with timestamps.
    The frontend can use the timestamps to seek the original video to those moments.
    """
    if file.content_type not in ("video/mp4", "video/mpeg", "video/quicktime"):
        raise HTTPException(status_code=400, detail="Only MP4 videos are accepted.")

    tmp_path = None
    try:
        # Write to a temp file so OpenCV can open it
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # Run the CPU-heavy loop in a thread so we don't block the event loop
        loop = asyncio.get_event_loop()
        detections_log, total_frames_sampled = await loop.run_in_executor(
            None, partial(_process_video_sync, tmp_path)
        )

        return {
            "total_frames_sampled": total_frames_sampled,
            "total_detections": len(detections_log),
            # Frontend expects the key "violations" to populate the violation log UI
            "violations": detections_log,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

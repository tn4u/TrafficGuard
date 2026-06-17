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


# Minimum confidence to accept a motorbike detection
_MIN_CONF = 0.35
# Minimum votes before we can finalize a bike's helmet status
_MIN_VOTES = 2


def _finalize_track(track_id, votes, completed_ids, frame, timestamp, detections_log, violations_dir):
    """Finalize a tracked motorcycle's helmet verdict and log any violation."""
    if track_id in completed_ids:
        return
    if votes[track_id]["helmet"] + votes[track_id]["no_helmet"] < 2:
        return  # Too few observations — skip

    completed_ids.add(track_id)
    if votes[track_id]["no_helmet"] > votes[track_id]["helmet"]:
        x1, y1, x2, y2 = (votes[track_id]["best_box"] or [0, 0, 10, 10])
        if frame is not None:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.putText(frame, f"No Helmet", (x1, max(0, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        img_filename = f"violation_{track_id}_{int(timestamp * 100)}.jpg"
        img_path = os.path.join(violations_dir, img_filename)
        if frame is not None:
            cv2.imwrite(img_path, frame)
        detections_log.append({
            "id": f"track_{track_id}",
            "timestamp": timestamp,
            "confidence": round(votes[track_id]["best_conf"], 4),
            "label": "no_helmet",
            "bbox": votes[track_id]["best_box"],
            "image_path": f"/static/violations/{img_filename}"
        })


def _process_video_sync(tmp_path: str):
    """
    CPU-bound video processing — runs in a thread executor so it does not
    block the async event loop.

    Strategy:
    - Sample at ~15 FPS using direct frame-seeking (avoids decoding every frame).
    - Filter detections by confidence >= _MIN_CONF to reduce noise.
    - Use a multi-frame voting system with _MIN_VOTES threshold.
    - Finalize any remaining unresolved tracks at the end of the video.
    """
    cap = cv2.VideoCapture(tmp_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # Target 10 samples per second to ensure ByteTrack IoU matching succeeds
    target_fps = 10
    step = max(1, int(fps / target_fps))

    detections_log = []
    tracking_data = []

    votes = {}          # track_id -> { helmet, no_helmet, best_conf, best_box, status }
    completed_ids = set()

    violations_dir = os.path.join(os.getcwd(), "violations")
    os.makedirs(violations_dir, exist_ok=True)

    current_idx = 0
    last_frame = None
    last_timestamp = 0.0

    while current_idx < total_frames:
        # Fast-forward frames without decoding the full image matrix using grab()
        ret = cap.grab()
        if not ret:
            break
            
        if current_idx % step != 0:
            current_idx += 1
            continue

        ret, frame = cap.retrieve()
        if not ret:
            break

        timestamp = round(current_idx / fps, 3)
        last_frame = frame.copy()
        last_timestamp = timestamp

        # Run ByteTrack on this frame
        results = yolo_service.track_sync(frame)

        frame_objects = []

        for r in results:
            if r.boxes is None or r.boxes.id is None:
                continue

            boxes = r.boxes.xyxy.cpu().numpy()
            track_ids = r.boxes.id.int().cpu().tolist()
            classes = r.boxes.cls.int().cpu().tolist()
            confs = r.boxes.conf.cpu().tolist()

            for box, track_id, class_id, conf in zip(boxes, track_ids, classes, confs):
                # Only motorcycles (class 0) above confidence threshold
                if class_id != 0 or conf < _MIN_CONF:
                    continue

                x1, y1, x2, y2 = map(int, box)

                if track_id not in votes:
                    votes[track_id] = {
                        "helmet": 0, "no_helmet": 0,
                        "best_conf": 0, "best_box": None,
                        "status": "Unknown"
                    }

                if conf > votes[track_id]["best_conf"]:
                    votes[track_id]["best_conf"] = conf
                    votes[track_id]["best_box"] = [x1, y1, x2, y2]

                # Helmet check (if not already finalized)
                if track_id not in completed_ids:
                    if y2 > y1 and x2 > x1:
                        rider_crop = yolo_service._get_rider_crop(frame, x1, y1, x2, y2)
                        if rider_crop is not None:
                            h_res = yolo_service.helmet_model(
                                rider_crop,
                                conf=yolo_service._HELMET_CONF_THRESH,
                                imgsz=320,
                                verbose=False,
                            )
                            best_h_conf = 0.0
                            h_status = "unknown"
                            for hr in h_res:
                                for h_box in hr.boxes:
                                    hc = float(h_box.conf[0])
                                    hcls = int(h_box.cls[0])
                                    if hc > best_h_conf:
                                        best_h_conf = hc
                                        h_status = yolo_service.helmet_model.names[hcls]

                            if h_status in ("helmet", "no_helmet") and best_h_conf >= yolo_service._HELMET_CONF_THRESH:
                                votes[track_id][h_status] += 1
                                votes[track_id]["status"] = (
                                    "No Helmet"
                                    if votes[track_id]["no_helmet"] > votes[track_id]["helmet"]
                                    else "Helmet"
                                )

                    # Finalize once enough votes are collected
                    total_v = votes[track_id]["helmet"] + votes[track_id]["no_helmet"]
                    if total_v >= _MIN_VOTES:
                        _finalize_track(
                            track_id, votes, completed_ids,
                            frame, timestamp, detections_log, violations_dir
                        )

                # Record this object in the tracking timeline
                frame_objects.append({
                    "id": track_id,
                    "bbox": [x1, y1, x2, y2],
                    "label": votes[track_id]["status"],
                    "conf": round(conf, 4),
                })

        if frame_objects:
            tracking_data.append({"timestamp": timestamp, "objects": frame_objects})

        current_idx += 1

    cap.release()

    # Final sweep: finalize any bikes that never accumulated enough votes mid-video
    # (e.g. bikes that entered the frame only near the end)
    for track_id in list(votes.keys()):
        _finalize_track(
            track_id, votes, completed_ids,
            last_frame, last_timestamp, detections_log, violations_dir
        )

    total_frames_sampled = max(1, len(tracking_data))
    return detections_log, total_frames_sampled, tracking_data


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
        detections_log, total_frames_sampled, tracking_data = await loop.run_in_executor(
            None, partial(_process_video_sync, tmp_path)
        )

        return {
            "total_frames_sampled": total_frames_sampled,
            "total_detections": len(detections_log),
            # Frontend expects the key "violations" to populate the violation log UI
            "violations": detections_log,
            "tracking_data": tracking_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

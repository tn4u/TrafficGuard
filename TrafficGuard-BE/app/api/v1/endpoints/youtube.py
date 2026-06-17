from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import cv2
import numpy as np
import io
import asyncio
import yt_dlp
import traceback
from app.services.yolo_service import yolo_service
from collections import defaultdict

router = APIRouter()

def get_youtube_stream_url(youtube_url: str) -> str:
    """Extract direct stream URL using yt-dlp."""
    ydl_opts = {
        'format': 'best',
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {'youtube': {'player_client': ['android']}}
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(youtube_url, download=False)
            if 'url' in info:
                return info['url']
            elif 'formats' in info:
                best_format = max(info['formats'], key=lambda f: f.get('height', 0) if f.get('height') else 0)
                return best_format['url']
            else:
                raise ValueError("Could not extract stream URL")
        except Exception as e:
            raise ValueError(f"yt-dlp error: {e}")

async def generate_mjpeg_stream(stream_url: str):
    """Generator that reads frames from the stream, processes with YOLO, and yields MJPEG chunks."""
    print(f"Opening stream with OpenCV: {stream_url[:100]}...")
    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print("cv2.VideoCapture failed to open the stream.")
        raise HTTPException(status_code=400, detail="Could not open video stream")
    print("Stream successfully opened. Starting frame processing.")

    _MIN_CONF = 0.3
    _MIN_VOTES = 5
    votes = defaultdict(lambda: {"helmet": 0, "no_helmet": 0, "status": "unknown"})
    active_tracks = set()

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            # Resize frame for performance if it's too large (e.g. 1080p -> 720p)
            height, width = frame.shape[:2]
            if width > 1280:
                scale = 1280 / width
                frame = cv2.resize(frame, (int(width * scale), int(height * scale)))
                
            # Run ByteTrack on this frame
            results = yolo_service.track_sync(frame)
            current_frame_tracks = set()
            
            if results and len(results) > 0 and results[0].boxes is not None and results[0].boxes.id is not None:
                r = results[0]
                boxes = r.boxes.xyxy.cpu().numpy()
                track_ids = r.boxes.id.int().cpu().tolist()
                classes = r.boxes.cls.int().cpu().tolist()
                confs = r.boxes.conf.cpu().tolist()

                for box, track_id, class_id, conf in zip(boxes, track_ids, classes, confs):
                    # Only motorcycles
                    if class_id != 0 or conf < _MIN_CONF:
                        continue
                        
                    current_frame_tracks.add(track_id)
                    x1, y1, x2, y2 = map(int, box)
                    
                    # If we don't have enough votes, run helmet detection
                    if votes[track_id]["helmet"] + votes[track_id]["no_helmet"] < _MIN_VOTES:
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
                    
                    # Draw bounding box
                    color = (0, 180, 60) if votes[track_id]["status"] == "Helmet" else \
                            (0, 0, 220) if votes[track_id]["status"] == "No Helmet" else \
                            (0, 165, 255) # Orange
                            
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    
                    # Draw label
                    label_text = f"#{track_id} {votes[track_id]['status']}"
                    (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
                    cv2.rectangle(frame, (x1, y1 - th - 5), (x1 + tw, y1), color, -1)
                    cv2.putText(frame, label_text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
            
            # Cleanup old tracks to prevent memory leak
            for t_id in list(active_tracks - current_frame_tracks):
                if t_id in votes:
                    del votes[t_id]
            active_tracks = current_frame_tracks
                    
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                   
            # Yield control to event loop so other requests aren't blocked
            await asyncio.sleep(0.01)
            
    finally:
        cap.release()

@router.get("/stream")
async def stream_youtube(url: str = Query(..., description="YouTube Livestream URL")):
    try:
        stream_url = get_youtube_stream_url(url)
        return StreamingResponse(
            generate_mjpeg_stream(stream_url),
            media_type="multipart/x-mixed-replace; boundary=frame"
        )
    except Exception as e:
        print(f"Error processing youtube stream: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

import os
import cv2
import numpy as np
from typing import Dict, List, Any, Tuple
from ultralytics import YOLO
from app.core.config import settings

# ── Per-class colour palette (BGR) ──────────────────────────────────────────
# Each class_id maps to a distinct, high-contrast colour.
CLASS_COLORS = [
    (0, 140, 255),   # class 0 → orange  (motorcycle)
    (255, 80,  80),  # class 1 → blue    (bicycle)
    (0, 220,  90),   # class 2 → green
    (200,  0, 200),  # class 3 → purple
    (0, 200, 200),   # class 4 → cyan
]

def _get_color(class_id: int) -> Tuple[int, int, int]:
    return CLASS_COLORS[class_id % len(CLASS_COLORS)]


def _draw_label(
    frame: np.ndarray,
    text: str,
    x1: int, y1: int, x2: int, y2: int,
    color: Tuple[int, int, int],
    font_scale: float = 0.48,
    thickness: int = 1,
):
    """
    Draw a filled pill-shaped label tag above (or inside) a bounding box.
    Falls back to drawing inside the box when there's no room above.
    """
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    pad_x, pad_y = 6, 4

    tag_w = tw + pad_x * 2
    tag_h = th + pad_y * 2 + baseline

    # Preferred: above the box
    ty = y1 - tag_h - 2
    if ty < 0:
        # Fall back: inside the box, top-left corner
        ty = y1 + 2

    tx = x1
    # Keep tag within frame width
    if tx + tag_w > frame.shape[1]:
        tx = frame.shape[1] - tag_w - 1
    if tx < 0:
        tx = 0

    # Filled background rectangle
    cv2.rectangle(frame, (tx, ty), (tx + tag_w, ty + tag_h), color, cv2.FILLED)

    # Lighter border around the tag for crispness
    cv2.rectangle(frame, (tx, ty), (tx + tag_w, ty + tag_h), (255, 255, 255), 1)

    # White text on top
    cv2.putText(
        frame, text,
        (tx + pad_x, ty + pad_y + th),
        font, font_scale,
        (255, 255, 255),
        thickness,
        cv2.LINE_AA,
    )


def _draw_summary_bar(frame: np.ndarray, counts: Dict[str, int], total: int):
    """
    Draw a semi-transparent summary bar at the very top of the frame.
    Shows total count and a breakdown by class.
    """
    h, w = frame.shape[:2]
    bar_h = 36

    # Semi-transparent dark strip
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, bar_h), (20, 20, 20), cv2.FILLED)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)

    font = cv2.FONT_HERSHEY_SIMPLEX

    # Total on the left
    cv2.putText(
        frame,
        f"Detections: {total}",
        (10, 24),
        font, 0.55,
        (255, 255, 255),
        1, cv2.LINE_AA,
    )

    # Per-class counts on the right
    x_cursor = w - 10
    for label, cnt in reversed(list(counts.items())):
        tag = f"{label}: {cnt}"
        (tw, _), _ = cv2.getTextSize(tag, font, 0.45, 1)
        x_cursor -= (tw + 20)
        cv2.putText(frame, tag, (x_cursor, 24), font, 0.45, (200, 200, 200), 1, cv2.LINE_AA)


class YOLOService:
    def __init__(self):
        self.model = None
        self.helmet_model = None
        self.load_model()

    def load_model(self):
        """Load the custom trained YOLO model"""
        try:
            model_path = os.path.join(settings.MODEL_DIR, "motobike_detection.pt")
            helmet_path = os.path.join(settings.MODEL_DIR, "helmet_detection.pt")
            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"Model not found at {model_path}. "
                    f"Please place motobike_detection.pt in {settings.MODEL_DIR}"
                )
            if not os.path.exists(helmet_path):
                raise FileNotFoundError(
                    f"Helmet Model not found at {helmet_path}."
                )
            self.model = YOLO(model_path)
            self.helmet_model = YOLO(helmet_path)
            print(f"Custom model loaded successfully from {model_path}")
            print(f"Helmet model loaded successfully from {helmet_path}")
            print(f"Model classes: {self.model.names}")
        except Exception as e:
            print(f"Error loading custom model: {e}")
            raise

    # ── Tuning constants ────────────────────────────────────────────────────
    # Minimum confidence to accept a motorcycle detection from the main model
    _MOTO_CONF_THRESH = 0.35
    # Minimum confidence to trust a helmet detection result
    _HELMET_CONF_THRESH = 0.10
    # Minimum crop side-length (px) sent to the helmet model;
    # small crops are upscaled for better recognition
    _MIN_CROP_SIZE = 128
    # Fraction of the motorcycle box height used for the rider crop.
    # The rider sits in roughly the top 55% of the detected motorcycle box.
    _RIDER_CROP_RATIO = 0.55

    def _get_rider_crop(
        self, frame: np.ndarray, x1: int, y1: int, x2: int, y2: int
    ) -> np.ndarray:
        """
        Extract the rider's upper-body region from a motorcycle bounding box.

        Helmets appear in the upper portion of the motorcycle box. We crop
        the top `_RIDER_CROP_RATIO` of the height and add a small upward
        padding buffer so heads sitting at the very top of the box aren't
        clipped, then upscale to a minimum size for the helmet model.
        """
        img_h, img_w = frame.shape[:2]
        box_h = y2 - y1

        # Add 10% of box height as padding above the crop (clipped to image top)
        pad_top = int(box_h * 0.10)
        crop_y1 = max(0, y1 - pad_top)
        # Take the upper portion of the box for the rider's head/torso
        crop_y2 = min(img_h, y1 + int(box_h * self._RIDER_CROP_RATIO))
        crop_x1 = max(0, x1)
        crop_x2 = min(img_w, x2)

        crop = frame[crop_y1:crop_y2, crop_x1:crop_x2]
        if crop.size == 0:
            return None

        # Upscale tiny crops so the model sees enough detail.
        # Use INTER_LANCZOS4 for better edge preservation than cubic.
        h, w = crop.shape[:2]
        if h < self._MIN_CROP_SIZE or w < self._MIN_CROP_SIZE:
            scale = self._MIN_CROP_SIZE / min(h, w)
            new_w = max(self._MIN_CROP_SIZE, int(w * scale))
            new_h = max(self._MIN_CROP_SIZE, int(h * scale))
            crop = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

        return crop

    async def detect(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Perform traffic detection on a frame using custom model.
        Returns detection results and road fullness.

        Accuracy improvements vs. naive implementation:
        - Only accepts motorcycle detections above _MOTO_CONF_THRESH.
        - Runs helmet detection on the upper-body crop (not the full bike box).
        - Requires helmet confidence >= _HELMET_CONF_THRESH; anything below
          stays as 'unknown' rather than accepting a noisy low-conf guess.
        - Upscales tiny rider crops before running the helmet model.
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")

        try:
            results = self.model(frame, conf=self._MOTO_CONF_THRESH, iou=0.45)

            frame_area = frame.shape[0] * frame.shape[1]
            vehicle_area = 0
            detections = []

            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
                    label = self.model.names[class_id]
                    if label.lower() == "motorcycle":
                        label = "motorbike"
                    elif label.lower() == "bike":
                        label = "bicycle"

                    vehicle_area += (x2 - x1) * (y2 - y1)

                    detection_dict = {
                        "label": label,
                        "confidence": confidence,
                        "bbox": [x1, y1, x2, y2],
                        "class_id": class_id,
                        "helmet_status": "unknown",
                        "helmet_confidence": 0.0,
                    }

                    # Run helmet detection on motorcycle crops only
                    if class_id == 0 and y2 > y1 and x2 > x1:
                        rider_crop = self._get_rider_crop(frame, x1, y1, x2, y2)
                        if rider_crop is not None:
                            h_res = self.helmet_model(
                                rider_crop,
                                conf=self._HELMET_CONF_THRESH,
                                imgsz=320,
                                verbose=False,
                            )
                            best_h_conf = 0.0
                            h_status = "unknown"
                            for hr in h_res:
                                for h_box in hr.boxes:
                                    h_conf = float(h_box.conf[0])
                                    h_cls = int(h_box.cls[0])
                                    if h_conf > best_h_conf:
                                        best_h_conf = h_conf
                                        h_status = self.helmet_model.names[h_cls]

                            # Only accept if confidence meets threshold
                            if h_status in ("helmet", "no_helmet") and best_h_conf >= self._HELMET_CONF_THRESH:
                                detection_dict["helmet_status"] = h_status
                                detection_dict["helmet_confidence"] = round(best_h_conf, 4)

                    detections.append(detection_dict)

            fullness = (vehicle_area / frame_area) * 100 if frame_area > 0 else 0

            return {
                "detections": detections,
                "fullness": fullness,
                "total_vehicles": len(detections),
            }
        except Exception as e:
            print(f"Error during detection: {e}")
            raise

    def track_sync(self, frame: np.ndarray) -> List[Any]:
        """
        Synchronously perform traffic detection and tracking on a frame using custom model.
        - conf=0.35: reject low-confidence noise boxes
        - iou=0.45:  tighter NMS overlap threshold for cleaner box separation
        - persist=True: ByteTrack maintains track IDs across consecutive frames
        Returns the raw YOLO results.
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")

        try:
            results = self.model.track(
                frame,
                persist=True,
                tracker="bytetrack.yaml",
                conf=0.35,
                iou=0.45,
                verbose=False,
            )
            return results
        except Exception as e:
            print(f"Error during tracking: {e}")
            raise

    async def detect_with_visualization(self, frame: np.ndarray) -> Tuple[Dict, np.ndarray]:
        """
        Run detection and return both results and a clean annotated frame.
        Each detection gets:
          • A coloured bounding box: green (helmet) / red (no_helmet) / orange (unknown)
          • A numbered badge in the top-left corner of the box
          • A pill-shaped label tag showing motorbike conf + helmet verdict + helmet conf
        A summary bar at the top shows totals.
        """
        results = await self.detect(frame)
        vis = frame.copy()

        counts: Dict[str, int] = {}
        per_class_idx: Dict[int, int] = {}  # running index per class_id

        for det in results["detections"]:
            x1, y1, x2, y2 = det["bbox"]
            label = det["label"]
            conf = det["confidence"]
            class_id = det["class_id"]

            helmet_status = det.get("helmet_status", "unknown")
            helmet_conf = det.get("helmet_confidence", 0.0)

            # Colour-code the box by helmet result
            if class_id == 0:
                if helmet_status == "helmet":
                    color = (0, 180, 60)     # Green
                elif helmet_status == "no_helmet":
                    color = (0, 0, 220)      # Red (BGR)
                else:
                    color = (0, 140, 255)    # Orange — unknown
            else:
                color = _get_color(class_id)

            # Per-class running index (1-based)
            per_class_idx[class_id] = per_class_idx.get(class_id, 0) + 1
            idx = per_class_idx[class_id]

            counts[label] = counts.get(label, 0) + 1

            # ── Bounding box ──────────────────────────────────────────────
            box_thickness = max(2, int((x2 - x1 + y2 - y1) / 200))
            cv2.rectangle(vis, (x1, y1), (x2, y2), color, box_thickness)

            # ── Numbered badge (top-left corner of box) ───────────────────
            badge_text = str(idx)
            badge_r = 11
            badge_cx = x1 + badge_r
            badge_cy = y1 + badge_r
            cv2.circle(vis, (badge_cx, badge_cy), badge_r, color, cv2.FILLED)
            cv2.circle(vis, (badge_cx, badge_cy), badge_r, (255, 255, 255), 1)
            (bw, bh), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
            cv2.putText(
                vis, badge_text,
                (badge_cx - bw // 2, badge_cy + bh // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38,
                (255, 255, 255), 1, cv2.LINE_AA,
            )

            # ── Label tag ─────────────────────────────────────────────────
            if helmet_status and helmet_status != "unknown":
                label_text = f"{label} {conf:.0%} | {helmet_status.replace('_',' ')} {helmet_conf:.0%}"
            else:
                label_text = f"{label}  {conf:.0%} | helmet: ?"
            _draw_label(vis, label_text, x1, y1, x2, y2, color)

        # ── Summary bar ───────────────────────────────────────────────────
        _draw_summary_bar(vis, counts, results["total_vehicles"])

        return results, vis

    def draw_detections(self, frame: np.ndarray, detections: List[Dict]) -> np.ndarray:
        """Draw detection boxes on the frame (used by the live camera stream)."""
        try:
            for det in detections:
                x1, y1, x2, y2 = det["bbox"]
                label = det["label"]
                if label.lower() == "motorcycle":
                    label = "motorbike"
                elif label.lower() == "bike":
                    label = "bicycle"
                conf = det["confidence"]
                class_id = det.get("class_id", 0)
                color = _get_color(class_id)

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                _draw_label(frame, f"{label}  {conf:.0%}", x1, y1, x2, y2, color)

            return frame
        except Exception as e:
            print(f"Error drawing detections: {e}")
            return frame


# Create singleton instance
yolo_service = YOLOService()
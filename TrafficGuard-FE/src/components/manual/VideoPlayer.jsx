import React, { useEffect, useRef, useState, useCallback } from "react";
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiMaximize } from "react-icons/fi";

/**
 * Compute the letterbox-aware rendered rect of a video element inside its
 * CSS container, mimicking object-fit: contain.
 *
 * Returns { offsetX, offsetY, scaleX, scaleY } — transforms native video
 * pixel coords into canvas display pixel coords via:
 *   canvasX = offsetX + nativeX * scaleX
 *   canvasY = offsetY + nativeY * scaleY
 */
function getVideoRenderRect(canvas, video) {
  const containerW = canvas.clientWidth;
  const containerH = canvas.clientHeight;
  const videoW = video.videoWidth;
  const videoH = video.videoHeight;
  if (!containerW || !containerH || !videoW || !videoH) return null;

  const containerAspect = containerW / containerH;
  const videoAspect = videoW / videoH;

  let renderW, renderH;
  if (videoAspect > containerAspect) {
    // Letterbox: video is wider → pillarbox on top/bottom
    renderW = containerW;
    renderH = containerW / videoAspect;
  } else {
    // Letterbox: video is taller → bars on left/right
    renderH = containerH;
    renderW = containerH * videoAspect;
  }

  const offsetX = (containerW - renderW) / 2;
  const offsetY = (containerH - renderH) / 2;

  return {
    offsetX,
    offsetY,
    scaleX: renderW / videoW,
    scaleY: renderH / videoH,
  };
}

function drawBoxes(canvas, video, trackingData, currentTime) {
  if (!canvas || !video || !video.videoWidth) return;

  // Canvas internal resolution = container CSS pixels (for sharp drawing at any size)
  const dpr = window.devicePixelRatio || 1;
  const containerW = canvas.clientWidth;
  const containerH = canvas.clientHeight;

  const targetW = Math.round(containerW * dpr);
  const targetH = Math.round(containerH * dpr);
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!trackingData || trackingData.length === 0) return;

  // Find the closest tracking frame to current playback time
  let closestFrame = trackingData[0];
  let minDiff = Math.abs(currentTime - closestFrame.timestamp);
  for (let i = 1; i < trackingData.length; i++) {
    const diff = Math.abs(currentTime - trackingData[i].timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closestFrame = trackingData[i];
    }
  }

  // No nearby frame (e.g., scrubbed past end of data)
  if (minDiff > 0.6) return;

  // Compute letterbox-aware transform from native video pixels → canvas pixels
  const rect = getVideoRenderRect(canvas, video);
  if (!rect) return;
  const { offsetX, offsetY, scaleX, scaleY } = rect;

  // Scale everything up by devicePixelRatio
  const ox = offsetX * dpr;
  const oy = offsetY * dpr;
  const sx = scaleX * dpr;
  const sy = scaleY * dpr;

  closestFrame.objects.forEach(({ bbox, label, conf }) => {
    const [vx1, vy1, vx2, vy2] = bbox;

    // Project from native video pixels → canvas display pixels
    const bx = ox + vx1 * sx;
    const by = oy + vy1 * sy;
    const bw = (vx2 - vx1) * sx;
    const bh = (vy2 - vy1) * sy;

    const isHelmet = label === "Helmet";
    const isUnknown = label === "Unknown";
    const color = isUnknown ? "#6b7280" : isHelmet ? "#16a34a" : "#dc2626";
    const cs = Math.max(10, Math.min(18, bw * 0.12));

    // Semi-transparent fill
    ctx.fillStyle = color + "1a";
    ctx.fillRect(bx, by, bw, bh);

    // Main border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(bx, by, bw, bh);

    // Corner accents
    ctx.lineWidth = 3 * dpr;
    [
      [bx, by, cs, cs],
      [bx + bw, by, -cs, cs],
      [bx, by + bh, cs, -cs],
      [bx + bw, by + bh, -cs, -cs],
    ].forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy);
      ctx.stroke();
    });

    // Label badge
    const fontSize = Math.max(11, Math.min(15, bw * 0.08)) * dpr;
    ctx.font = `bold ${fontSize}px monospace`;
    const text = `${label}  ${Math.round(conf * 100)}%`;
    const tw = ctx.measureText(text).width + 12 * dpr;
    const th = fontSize + 6 * dpr;
    const labelY = by >= th ? by - th : by + bh;
    ctx.fillStyle = color + "dd";
    ctx.fillRect(bx, labelY, tw, th);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, bx + 6 * dpr, labelY + fontSize);
  });
}

const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const VideoPlayer = ({ videoUrl, videoRef, violations = [], trackingData = [] }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const trackingDataRef = useRef(trackingData);

  useEffect(() => {
    trackingDataRef.current = trackingData;
    const video = videoRef.current;
    if (video) {
      drawBoxes(canvasRef.current, video, trackingData, video.currentTime);
    }
  }, [trackingData, videoRef]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      drawBoxes(canvasRef.current, video, trackingDataRef.current, video.currentTime);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(rafRef.current);
      loop();
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
      drawBoxes(canvasRef.current, video, trackingDataRef.current, video.currentTime);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.paused) {
        drawBoxes(canvasRef.current, video, trackingDataRef.current, video.currentTime);
      }
    };
    const onMeta = () => {
      setDuration(video.duration);
      drawBoxes(canvasRef.current, video, trackingDataRef.current, video.currentTime);
    };
    const onEnded = () => {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnded);

    if (!video.paused && !video.ended) {
      setPlaying(true);
      cancelAnimationFrame(rafRef.current);
      loop();
    } else {
      drawBoxes(canvasRef.current, video, trackingDataRef.current, video.currentTime);
    }

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnded);
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoUrl, loop, videoRef]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleSeekClick = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
          AI Detection Video
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-600" /> Helmet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600" /> No Helmet
          </span>
        </div>
      </div>

      {/* Video area */}
      <div ref={containerRef} className="relative flex-1 bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          playsInline
          muted={muted}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-8">
          {/* Seek bar */}
          <div
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 relative group"
            onClick={handleSeekClick}
          >
            <div
              className="absolute top-0 left-0 h-full bg-emerald-400 rounded-full"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
            />
            {violations.map((v) => (
              <div
                key={v.id}
                className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-red-400 rounded-full"
                style={{ left: `${(v.timestamp / duration) * 100}%` }}
                title={`Violation @ ${fmt(v.timestamp)}`}
              />
            ))}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: duration ? `${(currentTime / duration) * 100}%` : "0%", transform: "translate(-50%, -50%)" }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-emerald-400 transition-colors">
              {playing ? <FiPause className="text-xl" /> : <FiPlay className="text-xl" />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-emerald-400 transition-colors">
              {muted ? <FiVolumeX className="text-lg" /> : <FiVolume2 className="text-lg" />}
            </button>
            <span className="text-xs font-mono text-white/70">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
            <div className="ml-auto">
              <button
                onClick={() => containerRef.current?.requestFullscreen?.()}
                className="text-white hover:text-emerald-400 transition-colors"
              >
                <FiMaximize className="text-lg" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;

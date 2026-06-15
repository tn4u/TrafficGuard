import React, { useEffect, useRef, useState, useCallback } from "react";
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiMaximize } from "react-icons/fi";

// Mock bounding boxes drawn onto the canvas overlay
const MOCK_BOXES = [
  { x: 0.08, y: 0.1, w: 0.18, h: 0.32, label: "Helmet", color: "#16a34a", conf: 0.96 },
  { x: 0.55, y: 0.08, w: 0.17, h: 0.3, label: "No Helmet", color: "#dc2626", conf: 0.91 },
  { x: 0.33, y: 0.5, w: 0.15, h: 0.25, label: "Helmet", color: "#16a34a", conf: 0.88 },
];

function drawBoxes(canvas, video) {
  if (!canvas || !video || !video.videoWidth) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  MOCK_BOXES.forEach(({ x, y, w, h, label, color, conf }) => {
    const bx = x * canvas.width;
    const by = y * canvas.height;
    const bw = w * canvas.width;
    const bh = h * canvas.height;
    const cs = 14;

    ctx.fillStyle = color + "18";
    ctx.fillRect(bx, by, bw, bh);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.lineWidth = 3;
    [[bx, by, cs, cs], [bx + bw, by, -cs, cs], [bx, by + bh, cs, -cs], [bx + bw, by + bh, -cs, -cs]].forEach(
      ([cx, cy, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy);
        ctx.stroke();
      }
    );

    ctx.font = "bold 13px monospace";
    const text = `${label}  ${Math.round(conf * 100)}%`;
    const tw = ctx.measureText(text).width + 12;
    ctx.fillStyle = color + "cc";
    ctx.fillRect(bx, by - 22, tw, 22);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, bx + 6, by - 7);
  });
}

const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const VideoPlayer = ({ videoUrl, videoRef, violations = [] }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const loop = useCallback(() => {
    drawBoxes(canvasRef.current, videoRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => { setPlaying(true); loop(); };
    const onPause = () => { setPlaying(false); cancelAnimationFrame(rafRef.current); drawBoxes(canvasRef.current, video); };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onMeta = () => { setDuration(video.duration); drawBoxes(canvasRef.current, video); };
    const onEnded = () => { setPlaying(false); cancelAnimationFrame(rafRef.current); };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnded);

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
          style={{ objectFit: "contain" }}
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

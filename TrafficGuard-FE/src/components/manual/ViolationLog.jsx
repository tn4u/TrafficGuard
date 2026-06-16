import React, { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiClock, FiChevronRight, FiShield } from "react-icons/fi";

const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  const ds = Math.floor((t % 1) * 10);
  return `${m}:${s}.${ds}`;
};

function captureFrames(videoUrl, violations) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.muted = true;
    video.crossOrigin = "anonymous";

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");

    const results = {};
    let idx = 0;

    const next = () => {
      if (idx >= violations.length) { resolve(results); return; }
      video.currentTime = violations[idx].timestamp;
    };

    video.addEventListener("loadedmetadata", next);
    video.addEventListener("seeked", () => {
      ctx.drawImage(video, 0, 0, 160, 90);
      // Red highlight box
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 2;
      const bx = 85, by = 12, bw = 52, bh = 58;
      ctx.fillStyle = "#dc262630";
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      results[violations[idx].id] = canvas.toDataURL("image/jpeg", 0.85);
      idx++;
      next();
    });
    video.addEventListener("error", () => resolve(results));
    video.load();
  });
}

const ViolationLog = ({ violations, videoUrl, onSeek }) => {
  const [thumbnails, setThumbnails] = useState({});
  const [loadingThumbs, setLoadingThumbs] = useState(true);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!videoUrl || violations.length === 0) { setLoadingThumbs(false); return; }
    setLoadingThumbs(true);
    captureFrames(videoUrl, violations).then((results) => {
      setThumbnails(results);
      setLoadingThumbs(false);
    });
  }, [videoUrl, violations]);

  const handleClick = (v) => {
    setActiveId(v.id);
    onSeek(v.timestamp);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0 pb-3 border-b border-gray-100">
        <FiAlertTriangle className="text-emerald-500 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Detection Log</h3>
        <span className="ml-auto bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full border border-emerald-200 flex-shrink-0 font-medium">
          {violations.length} found
        </span>
      </div>

      {violations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <FiShield className="text-emerald-500 text-xl" />
          </div>
          <p className="text-sm text-gray-500">No violations detected</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
          {violations.map((v, i) => (
            <button
              key={v.id}
              onClick={() => handleClick(v)}
              className={`
                w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 text-left group
                ${activeId === v.id
                  ? "bg-red-50 border-red-200 shadow-sm"
                  : "bg-white border-gray-200 hover:bg-red-50/50 hover:border-red-200"
                }
              `}
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {thumbnails[v.id] ? (
                  <img src={thumbnails[v.id]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {loadingThumbs ? (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
                    ) : (
                      <FiAlertTriangle className="text-red-400 text-xs" />
                    )}
                  </div>
                )}
                <div
                  className={`absolute inset-0 rounded-lg border-2 transition-colors ${
                    activeId === v.id ? "border-red-400" : "border-red-300 group-hover:border-red-400"
                  }`}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-700 mb-0.5 capitalize">{v.label} #{i + 1}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <FiClock className="text-xs flex-shrink-0" />
                  <span className="font-mono">{fmt(v.timestamp)}</span>
                </div>
              </div>

              {/* Confidence + arrow */}
              <div className="flex-shrink-0 flex items-center gap-1.5">
                <div className="text-right">
                  <span className="text-xs font-bold text-orange-500">{Math.round(v.confidence * 100)}%</span>
                  <p className="text-[10px] text-gray-400">conf</p>
                </div>
                <FiChevronRight className="text-gray-300 group-hover:text-red-400 transition-colors text-sm" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViolationLog;

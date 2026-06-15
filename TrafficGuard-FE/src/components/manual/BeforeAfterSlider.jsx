import React, { useState, useRef, useCallback, useEffect } from "react";

const BeforeAfterSlider = ({ originalUrl, processedUrl }) => {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);

  const move = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(((clientX - rect.left) / rect.width) * 100, 100));
    setPos(pct);
  }, []);

  const onMouseDown = (e) => { setDragging(true); move(e.clientX); };
  const onMouseMove = useCallback((e) => { if (dragging) move(e.clientX); }, [dragging, move]);
  const onTouchStart = (e) => { setDragging(true); move(e.touches[0].clientX); };
  const onTouchMove = useCallback((e) => { if (dragging) move(e.touches[0].clientX); }, [dragging, move]);

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
          Before / After Comparison
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-gray-300 rounded-sm" /> Original
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm" /> AI Processed
          </span>
        </div>
      </div>

      {/* Slider */}
      <div
        ref={containerRef}
        className="relative flex-1 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 select-none cursor-col-resize shadow-sm"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => setDragging(false)}
      >
        {/* Processed image (full behind) */}
        <img
          src={processedUrl}
          alt="AI processed"
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />

        {/* Original clipped */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${pos}%` }}
        >
          <img
            src={originalUrl}
            alt="Original"
            className="absolute inset-0 h-full object-contain"
            style={{ width: containerRef.current ? containerRef.current.offsetWidth + "px" : "100%" }}
            draggable={false}
          />
        </div>

        {/* Divider */}
        <div
          className="absolute top-0 bottom-0 z-10 pointer-events-none"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-0.5 h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          {/* Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-col-resize w-11 h-11 bg-white rounded-full shadow-lg border-2 border-emerald-400 flex items-center justify-center gap-0.5">
            <span className="text-emerald-600 text-sm font-bold select-none">‹</span>
            <span className="text-emerald-600 text-sm font-bold select-none">›</span>
          </div>
        </div>

        {/* Corner labels */}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs text-gray-600 font-medium pointer-events-none z-20 border border-gray-200 shadow-sm">
          Original
        </div>
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500/90 backdrop-blur-sm rounded-lg text-xs text-white font-medium pointer-events-none z-20 shadow-sm">
          AI Detected
        </div>

        {/* Hint */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs text-gray-500 pointer-events-none z-20 whitespace-nowrap border border-gray-200 shadow-sm">
          Drag to compare
        </div>
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
